import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Typography, Input, Select, Space } from 'antd'
import { CameraOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getItems, getSellers } from '../api/client'
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
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => getItems({ limit: 500 }).then(r => r.data),
  })

  const { data: sellers = [] } = useQuery<Seller[]>({
    queryKey: ['sellers'],
    queryFn: () => getSellers().then(r => r.data),
  })

  const sellerMap = Object.fromEntries(sellers.map(s => [s.id, s]))

  const closedItems = useMemo(() => {
    let result = items.filter(i => CLOSED_STATUSES.includes(i.status))
    if (filterStatus !== 'all') result = result.filter(i => i.status === filterStatus)
    if (filterCategory !== 'all') result = result.filter(i => i.category === filterCategory)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        (i.brand || '').toLowerCase().includes(q)
      )
    }
    return result.sort((a, b) => {
      const da = a.sold_at || a.listed_at || a.created_at
      const db = b.sold_at || b.listed_at || b.created_at
      return dayjs(db).unix() - dayjs(da).unix()
    })
  }, [items, filterStatus, filterCategory, search])

  const totalCommission = closedItems
    .filter(i => i.status === 'sold' || i.status === 'shipped' || i.status === 'delivered')
    .reduce((acc, i) => acc + Number(i.commission || 0), 0)

  const columns: ColumnsType<Item> = [
    {
      title: 'SKU', dataIndex: 'sku', width: 130,
      render: v => <span style={{ fontFamily: 'monospace', color: '#1a3a6b', fontSize: 12 }}>{v}</span>,
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
      title: 'Tiempo publicado', width: 130,
      render: (_, r) => {
        const days = daysPublished(r.listed_at, r.sold_at)
        if (days === null) return '—'
        return <Tag color={days > 30 ? 'red' : days > 14 ? 'orange' : 'default'}>{days} días</Tag>
      },
    },
    {
      title: 'Vendedora', dataIndex: 'seller_id', width: 140,
      render: (v, r) => {
        if (r.no_seller) return <Tag color="geekblue" style={{ fontSize: 11 }}>Admin</Tag>
        const s = sellerMap[v]
        return s ? <Text style={{ fontSize: 12 }}>{s.full_name}</Text> : '—'
      },
    },
    {
      title: 'Estado', dataIndex: 'status', width: 120,
      render: (v: ItemStatus) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
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
        <Space wrap>
          <Input.Search
            placeholder="Buscar SKU, artículo, marca…"
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 150 }}>
            <Option value="all">Todos los estados</Option>
            {CLOSED_STATUSES.map(s => (
              <Option key={s} value={s}>{STATUS_LABEL[s]}</Option>
            ))}
          </Select>
          <Select value={filterCategory} onChange={setFilterCategory} style={{ width: 140 }}>
            <Option value="all">Todas las categorías</Option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <Option key={k} value={k}>{v}</Option>
            ))}
          </Select>
        </Space>
      </div>

      <Table
        dataSource={closedItems}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 25 }}
      />
    </div>
  )
}
