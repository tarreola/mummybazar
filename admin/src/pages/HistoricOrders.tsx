import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Typography, Input, Space, Drawer, Descriptions, Select,
  Button, message, Divider,
} from 'antd'
import { CameraOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getItems, getSellers, updateItem } from '../api/client'
import type { Item, ItemStatus, Seller } from '../types'

const { Title, Text } = Typography
const { Option } = Select

const STATUS_COLOR: Record<ItemStatus, string> = {
  received: 'blue', inspected: 'cyan', listed: 'green',
  sold: 'gold', shipped: 'orange', delivered: 'purple',
  returned: 'red', archived: 'default',
}
const STATUS_LABEL: Record<ItemStatus, string> = {
  received: 'Recibido', inspected: 'Inspeccionado', listed: 'Publicado',
  sold: 'Vendido', shipped: 'Enviado', delivered: 'Entregado',
  returned: 'Devuelto', archived: 'Donado',
}
const CATEGORY_LABEL: Record<string, string> = {
  clothing: 'Ropa', furniture: 'Muebles', lactancy: 'Lactancia',
  strollers: 'Carriolas', toys: 'Juguetes', accessories: 'Accesorios', other: 'Otro',
}
const CLOSED_STATUSES: ItemStatus[] = ['sold', 'shipped', 'delivered', 'returned', 'archived']

const parseImages = (images?: string | null): string[] =>
  images ? images.split(',').filter(Boolean) : []

function daysPublished(listedAt?: string | null, soldAt?: string | null): number | null {
  if (!listedAt) return null
  const end = soldAt ? dayjs(soldAt) : dayjs()
  return end.diff(dayjs(listedAt), 'day')
}

export default function HistoricOrders() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [drawerItem, setDrawerItem] = useState<Item | null>(null)
  const [editStatus, setEditStatus] = useState<ItemStatus | null>(null)
  const [editSellerId, setEditSellerId] = useState<number | null | 'admin'>(null)

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => getItems({ limit: 500 }).then(r => r.data),
  })

  const { data: sellers = [] } = useQuery<Seller[]>({
    queryKey: ['sellers'],
    queryFn: () => getSellers().then(r => r.data),
  })

  const sellerMap = Object.fromEntries(sellers.map(s => [s.id, s]))

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => updateItem(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['items'] })
      setDrawerItem(res.data)
      message.success('Artículo actualizado')
    },
    onError: () => message.error('Error al actualizar'),
  })

  const openDrawer = (item: Item) => {
    setDrawerItem(item)
    setEditStatus(item.status)
    setEditSellerId(item.no_seller ? 'admin' : item.seller_id ?? null)
  }

  const saveChanges = () => {
    if (!drawerItem) return
    const data: Record<string, any> = {}
    if (editStatus && editStatus !== drawerItem.status) data.status = editStatus
    if (editSellerId === 'admin' && !drawerItem.no_seller) {
      data.no_seller = true
      data.seller_id = null
    } else if (editSellerId !== 'admin' && editSellerId !== drawerItem.seller_id) {
      data.no_seller = false
      data.seller_id = editSellerId
    }
    if (Object.keys(data).length === 0) { message.info('Sin cambios'); return }
    updateMutation.mutate({ id: drawerItem.id, data })
  }

  const closedItems = useMemo(() => {
    let result = items.filter(i => CLOSED_STATUSES.includes(i.status))
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        (i.brand || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [items, search])

  const totalCommission = closedItems
    .filter(i => ['sold', 'shipped', 'delivered'].includes(i.status))
    .reduce((acc, i) => acc + Number(i.commission || 0), 0)

  const columns: ColumnsType<Item> = [
    {
      title: 'SKU', dataIndex: 'sku', width: 130,
      render: (v, r) => (
        <a style={{ fontFamily: 'monospace', color: '#1a3a6b', fontSize: 12 }} onClick={() => openDrawer(r)}>{v}</a>
      ),
    },
    {
      title: 'Foto', dataIndex: 'images', width: 60,
      render: v => {
        const [first] = parseImages(v)
        return first
          ? <img src={first} width={40} height={50} style={{ objectFit: 'cover', borderRadius: 4, display: 'block' }} />
          : <div style={{ width: 40, height: 50, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CameraOutlined style={{ color: '#ccc' }} />
            </div>
      },
    },
    { title: 'Artículo', dataIndex: 'title', ellipsis: true },
    {
      title: 'Categoría', dataIndex: 'category', width: 110,
      render: v => CATEGORY_LABEL[v] || v,
      filters: Object.entries(CATEGORY_LABEL).map(([k, v]) => ({ text: v, value: k })),
      onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Precio', dataIndex: 'selling_price', width: 100,
      render: v => `$${Number(v).toLocaleString('es-MX')}`,
      sorter: (a, b) => Number(a.selling_price) - Number(b.selling_price),
    },
    {
      title: 'Comisión', dataIndex: 'commission', width: 100,
      render: (v, r) => (
        <span style={{ color: '#1a3a6b', fontWeight: 600 }}>
          ${Number(v || 0).toLocaleString('es-MX')}
          {r.no_seller && <Tag color="geekblue" style={{ marginLeft: 4, fontSize: 10 }}>100%</Tag>}
        </span>
      ),
      sorter: (a, b) => Number(a.commission || 0) - Number(b.commission || 0),
    },
    {
      title: 'Tiempo publicado', width: 140,
      defaultSortOrder: 'descend',
      sorter: (a, b) => {
        const da = daysPublished(a.listed_at, a.sold_at) ?? 0
        const db = daysPublished(b.listed_at, b.sold_at) ?? 0
        return da - db
      },
      render: (_, r) => {
        const days = daysPublished(r.listed_at, r.sold_at)
        if (days === null) return '—'
        return <Tag color={days > 30 ? 'red' : days > 14 ? 'orange' : 'default'}>{days} días</Tag>
      },
    },
    {
      title: 'Vendedora', dataIndex: 'seller_id', width: 140,
      filters: [
        { text: 'Admin', value: 'admin' },
        ...sellers.map(s => ({ text: s.full_name, value: s.id })),
      ],
      onFilter: (value, record) => {
        if (value === 'admin') return !!record.no_seller
        return record.seller_id === value
      },
      render: (v, r) => {
        if (r.no_seller) return <Tag color="geekblue" style={{ fontSize: 11 }}>Admin</Tag>
        const s = sellerMap[v]
        return s ? <Text style={{ fontSize: 12 }}>{s.full_name}</Text> : '—'
      },
    },
    {
      title: 'Estado', dataIndex: 'status', width: 120,
      filters: CLOSED_STATUSES.map(s => ({ text: STATUS_LABEL[s], value: s })),
      onFilter: (value, record) => record.status === value,
      render: (v: ItemStatus) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: '', width: 50,
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openDrawer(r)} />
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={4} style={{ color: '#1a3a6b', margin: 0 }}>Histórico de Pedidos</Title>
          <Space size={16} style={{ marginTop: 4 }}>
            <Text type="secondary">Total: <Text strong>{closedItems.length}</Text></Text>
            <Text type="secondary">Comisión total: <Text strong style={{ color: '#1a3a6b' }}>${totalCommission.toLocaleString('es-MX')}</Text></Text>
          </Space>
        </div>
        <Input.Search
          placeholder="Buscar SKU, artículo, marca…"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
      </div>

      <Table
        dataSource={closedItems}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 25 }}
      />

      <Drawer
        title={drawerItem ? `${drawerItem.sku} — ${drawerItem.title}` : ''}
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        width={400}
      >
        {drawerItem && (
          <>
            {parseImages(drawerItem.images).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {parseImages(drawerItem.images).map((url, i) => (
                  <img key={i} src={url} width={80} height={100}
                    style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #c8d8f0' }} />
                ))}
              </div>
            )}

            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Categoría">{CATEGORY_LABEL[drawerItem.category] || drawerItem.category}</Descriptions.Item>
              <Descriptions.Item label="Precio">${Number(drawerItem.selling_price).toLocaleString('es-MX')} MXN</Descriptions.Item>
              <Descriptions.Item label="Comisión">
                ${Number(drawerItem.commission || 0).toLocaleString('es-MX')} MXN
                {drawerItem.no_seller && <Tag color="geekblue" style={{ marginLeft: 6 }}>100%</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Pago vendedora">
                ${Number(drawerItem.seller_payout || 0).toLocaleString('es-MX')} MXN
              </Descriptions.Item>
              <Descriptions.Item label="Publicado">{drawerItem.listed_at ? dayjs(drawerItem.listed_at).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Vendido">{drawerItem.sold_at ? dayjs(drawerItem.sold_at).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '8px 0 12px' }}>Editar</Divider>

            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Estado</Text>
              <Select value={editStatus ?? drawerItem.status} onChange={v => setEditStatus(v)} style={{ width: '100%' }}>
                {Object.entries(STATUS_LABEL).map(([k, lbl]) => (
                  <Option key={k} value={k}>
                    <Tag color={STATUS_COLOR[k as ItemStatus]} style={{ margin: 0 }}>{lbl}</Tag>
                  </Option>
                ))}
              </Select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Vendedora</Text>
              <Select
                value={editSellerId === 'admin' ? 'admin' : (editSellerId ?? undefined)}
                onChange={v => setEditSellerId(v as number | 'admin')}
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="label"
              >
                <Option value="admin" label="Admin">
                  <Tag color="geekblue">Admin</Tag>
                </Option>
                {sellers.map(s => (
                  <Option key={s.id} value={s.id} label={s.full_name}>{s.full_name}</Option>
                ))}
              </Select>
            </div>

            <Button
              type="primary"
              block
              loading={updateMutation.isPending}
              onClick={saveChanges}
              style={{ background: '#1a3a6b', borderColor: '#1a3a6b' }}
            >
              Guardar cambios
            </Button>
          </>
        )}
      </Drawer>
    </div>
  )
}
