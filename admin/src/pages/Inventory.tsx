import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Modal, Form, Input, Select, InputNumber,
  Space, Typography, Tooltip, message, Drawer, Descriptions, Popconfirm,
  Image, Divider, Alert, Card, Checkbox,
} from 'antd'
import {
  PlusOutlined, EditOutlined, LinkOutlined,
  ClockCircleOutlined, CameraOutlined, DeleteOutlined, WarningOutlined,
  ArrowRightOutlined, FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getItems, createItem, updateItem, getSellers, uploadItemImage, deleteItemImage, deleteItem } from '../api/client'
import api from '../api/client'
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
const SOLD_STATUSES: ItemStatus[] = ['sold', 'shipped', 'delivered']
const GENDER_LABEL: Record<string, string> = {
  girl: 'Niña', boy: 'Niño', unisex: 'Unisex', adult: 'Adulto',
}
const CATEGORY_LABEL: Record<string, string> = {
  clothing: 'Ropa', furniture: 'Muebles', lactancy: 'Lactancia',
  strollers: 'Carriolas', toys: 'Juguetes', accessories: 'Accesorios', other: 'Otro',
}
const CONDITION_LABEL: Record<string, string> = {
  like_new: 'Como nuevo', good: 'Bueno', fair: 'Regular',
}

const parseImages = (images?: string | null): string[] =>
  images ? images.split(',').filter(Boolean) : []

function daysAgo(date?: string | null): number | null {
  if (!date) return null
  return dayjs().diff(dayjs(date), 'day')
}

type PhotoFile = { uid: string; name: string; url: string; originFileObj: File }

export default function Inventory() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filterSellerId, setFilterSellerId] = useState<number | null>(
    searchParams.get('seller_id') ? Number(searchParams.get('seller_id')) : null
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [drawerItem, setDrawerItem] = useState<Item | null>(null)
  const [fileList, setFileList] = useState<PhotoFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [filterCategories, setFilterCategories] = useState<string[]>([])
  const [noSellerFilter, setNoSellerFilter] = useState(false)
  const [form] = Form.useForm()

const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => getItems({ limit: 200 }).then(r => r.data),
  })

  const { data: stagnant = [] } = useQuery({
    queryKey: ['stagnant-items'],
    queryFn: () => api.get('/dashboard/stagnant-items?days=30&limit=20').then(r => r.data),
  })

  const { data: sellers = [] } = useQuery<Seller[]>({
    queryKey: ['sellers'],
    queryFn: () => getSellers().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: ({ data, files }: { data: object; files: PhotoFile[] }) => createItem(data),
    onSuccess: async (res, { files }) => {
      const id = res.data.id
      if (files.length > 0) {
        setUploadingImages(true)
        try {
          for (const f of files) await uploadItemImage(id, f.originFileObj)
        } catch {
          message.error('Error al subir fotos')
        } finally {
          setUploadingImages(false)
        }
      }
      await qc.invalidateQueries({ queryKey: ['items'] })
      setModalOpen(false)
      setFileList([])
      form.resetFields()
      message.success('Artículo creado')
    },
    onError: () => message.error('Error al guardar artículo'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data, files }: { id: number; data: object; files: PhotoFile[] }) => updateItem(id, data),
    onSuccess: async (res, { files }) => {
      const id = res.data.id
      if (files.length > 0) {
        setUploadingImages(true)
        try {
          for (const f of files) await uploadItemImage(id, f.originFileObj)
        } catch {
          message.error('Error al subir fotos')
        } finally {
          setUploadingImages(false)
        }
      }
      await qc.invalidateQueries({ queryKey: ['items'] })
      setModalOpen(false)
      setFileList([])
    },
    onError: () => message.error('Error al actualizar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      setDrawerItem(null)
      message.success('Artículo eliminado')
    },
    onError: () => message.error('Error al eliminar artículo'),
  })

  const openCreate = () => { setEditItem(null); form.resetFields(); setFileList([]); setModalOpen(true) }
  const openEdit = (item: Item) => {
    setEditItem(item)
    form.setFieldsValue({ ...item, selling_price: Number(item.selling_price) })
    setFileList([])
    setModalOpen(true)
  }
  const closeModal = () => { setModalOpen(false); setFileList([]) }

  const onSave = (values: object) => {
    if (editItem) updateMutation.mutate({ id: editItem.id, data: values, files: fileList })
    else createMutation.mutate({ data: values, files: fileList })
  }

  const markSoldOffPlatform = (item: Item) => {
    updateMutation.mutate({ id: item.id, data: { status: 'archived', notes: (item.notes || '') + '\n[Vendido fuera de plataforma]' }, files: [] })
    message.success(`${item.sku} marcado como vendido fuera de plataforma`)
  }

  const removeExistingPhoto = async (item: Item, url: string) => {
    await deleteItemImage(item.id, url)
    if (editItem?.id === item.id) {
      setEditItem({ ...editItem, images: parseImages(editItem.images).filter(u => u !== url).join(',') })
    }
    qc.invalidateQueries({ queryKey: ['items'] })
  }

  const total = items.length
  const listed = items.filter(i => i.status === 'listed').length
  const stagnantCount = items.filter(i => i.status === 'listed' && daysAgo(i.listed_at) !== null && daysAgo(i.listed_at)! > 30).length
  const sellerMap = Object.fromEntries(sellers.map(s => [s.id, s]))

  const CLOSED_ITEM_STATUSES: ItemStatus[] = ['sold', 'shipped', 'delivered', 'returned', 'archived']
  const filteredItems = useMemo(() => {
    let result = items
    if (!showClosed) result = result.filter(i => !CLOSED_ITEM_STATUSES.includes(i.status))
    if (filterCategories.length > 0) result = result.filter(i => filterCategories.includes(i.category))
    if (noSellerFilter) result = result.filter(i => i.no_seller)
    if (filterSellerId) result = result.filter(i => i.seller_id === filterSellerId)
    return result
  }, [items, showClosed, filterCategories, noSellerFilter, filterSellerId])

  // How many more photos can be added in the modal
  const existingCount = editItem ? parseImages(editItem.images).length : 0
  const maxNewPhotos = 6 - existingCount

  const columns: ColumnsType<Item> = [
    {
      title: 'SKU', dataIndex: 'sku', width: 130,
      render: (v, r) => (
        <a style={{ color: '#1a3a6b', fontFamily: 'monospace' }} onClick={() => setDrawerItem(r)}>{v}</a>
      ),
    },
    {
      title: 'Foto', dataIndex: 'images', width: 60,
      render: (v) => {
        const [first] = parseImages(v)
        return first
          ? <img src={first} width={40} height={50} style={{ objectFit: 'cover', borderRadius: 4, display: 'block' }} />
          : <div style={{ width: 40, height: 50, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CameraOutlined style={{ color: '#ccc' }} /></div>
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
      title: 'Condición', dataIndex: 'condition', width: 110,
      render: v => CONDITION_LABEL[v] || v,
      filters: Object.entries(CONDITION_LABEL).map(([k, v]) => ({ text: v, value: k })),
      onFilter: (value, record) => record.condition === value,
    },
    {
      title: 'Precio', dataIndex: 'selling_price', width: 110,
      render: v => `$${Number(v).toLocaleString('es-MX')}`,
      sorter: (a, b) => Number(a.selling_price) - Number(b.selling_price),
    },
    {
      title: 'Tiempo publicado', dataIndex: 'listed_at', width: 140,
      render: v => {
        if (!v) return '—'
        const days = daysAgo(v)!
        return (
          <Tag color={days > 30 ? 'red' : days > 14 ? 'orange' : 'default'} icon={<ClockCircleOutlined />}>
            {days} días
          </Tag>
        )
      },
      sorter: (a, b) => {
        if (!a.listed_at) return 1
        if (!b.listed_at) return -1
        return dayjs(a.listed_at).unix() - dayjs(b.listed_at).unix()
      },
    },
    {
      title: 'Vendedora', dataIndex: 'seller_id', width: 140,
      render: (v, r) => {
        if ((r as any).no_seller) return <Tag color="geekblue" style={{ fontSize: 11 }}>Admin</Tag>
        const s = sellerMap[v]
        return s ? <Text style={{ fontSize: 12 }}>{s.full_name}</Text> : '—'
      },
      filters: sellers.map(s => ({ text: s.full_name, value: s.id })),
      onFilter: (value, record) => record.seller_id === value,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 150,
      render: (v: ItemStatus, record) => (
        <Select
          size="small" value={v} style={{ width: 140 }}
          onChange={(status) => updateMutation.mutate({ id: record.id, data: { status }, files: [] })}
        >
          {Object.entries(STATUS_LABEL).map(([k, lbl]) => (
            <Option key={k} value={k}>
              <Tag color={STATUS_COLOR[k as ItemStatus]} style={{ margin: 0, fontSize: 11 }}>{lbl}</Tag>
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: '', width: 50,
      render: (_, record) => (
        <Tooltip title="Editar">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={4} style={{ color: '#1a3a6b', margin: 0 }}>Inventario</Title>
          <Space size={16} style={{ marginTop: 4 }}>
            <Text type="secondary">Total: <Text strong>{total}</Text></Text>
            <Text type="secondary">Publicados: <Text strong style={{ color: '#52c41a' }}>{listed}</Text></Text>
            {stagnantCount > 0 && <Text type="secondary">Sin movimiento: <Text strong style={{ color: '#f5222d' }}>{stagnantCount}</Text></Text>}
          </Space>
        </div>
        <Space wrap>
          {/* Category filter */}
          <Select
            mode="multiple"
            placeholder={<span><FilterOutlined /> Categorías</span>}
            value={filterCategories}
            onChange={setFilterCategories}
            allowClear
            style={{ minWidth: 160 }}
            maxTagCount={1}
          >
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
          </Select>
          <Tooltip title="Mostrar solo sin vendedor (100% comisión)">
            <Button
              icon={<FilterOutlined />}
              type={noSellerFilter ? 'primary' : 'default'}
              onClick={() => setNoSellerFilter(v => !v)}
              style={noSellerFilter ? { background: '#531dab', borderColor: '#531dab' } : {}}
            >
              Sin vendedor
            </Button>
          </Tooltip>
          <Tooltip title={showClosed ? 'Ocultar vendidos/archivados' : 'Mostrar vendidos/archivados'}>
            <Button
              icon={<FilterOutlined />}
              type={showClosed ? 'primary' : 'default'}
              onClick={() => setShowClosed(v => !v)}
              style={showClosed ? { background: '#595959', borderColor: '#595959' } : {}}
            >
              {showClosed ? 'Ocultar cerrados' : 'Ver cerrados'}
            </Button>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#1a3a6b', borderColor: '#1a3a6b' }}>
            Agregar artículo
          </Button>
        </Space>
      </div>

      <Table
        dataSource={filteredItems} columns={columns} rowKey="id" loading={isLoading}
        size="small" pagination={{ pageSize: 25 }}
        rowClassName={r => r.status === 'listed' && daysAgo(r.listed_at)! > 30 ? 'stagnant-row' : ''}
      />

      {/* Item detail drawer */}
      <Drawer
        title={drawerItem ? `${drawerItem.sku} — ${drawerItem.title}` : ''}
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        width={440}
        extra={
          drawerItem && (
            <Button
              icon={<EditOutlined />}
              onClick={() => { openEdit(drawerItem); setDrawerItem(null) }}
              style={{ borderColor: '#1a3a6b', color: '#1a3a6b' }}
            >
              Editar
            </Button>
          )
        }
      >
        {drawerItem && (
          <>
            {SOLD_STATUSES.includes(drawerItem.status) && (
              <Alert
                type="warning"
                showIcon
                message="Artículo ya vendido"
                description="Los cambios son solo informativos y no afectan el pedido activo."
                style={{ marginBottom: 12 }}
              />
            )}
            {/* Photo gallery */}
            {parseImages(drawerItem.images).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Image.PreviewGroup>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {parseImages(drawerItem.images).map((url, i) => (
                      <Image
                        key={i} src={url}
                        width={90} height={112}
                        style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #c8d8f0', cursor: 'zoom-in' }}
                      />
                    ))}
                  </div>
                </Image.PreviewGroup>
              </div>
            )}

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Estado">
                <Tag color={STATUS_COLOR[drawerItem.status]}>{STATUS_LABEL[drawerItem.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Categoría">{CATEGORY_LABEL[drawerItem.category] || drawerItem.category}</Descriptions.Item>
              <Descriptions.Item label="Condición">{CONDITION_LABEL[drawerItem.condition]}</Descriptions.Item>
              {drawerItem.gender && <Descriptions.Item label="Género">{GENDER_LABEL[drawerItem.gender] || drawerItem.gender}</Descriptions.Item>}

              <Descriptions.Item label="Marca">{drawerItem.brand || '—'}</Descriptions.Item>
              <Descriptions.Item label="Talla">{drawerItem.size || '—'}</Descriptions.Item>
              <Descriptions.Item label="Color">{drawerItem.color || '—'}</Descriptions.Item>
              <Descriptions.Item label="Precio original">{drawerItem.original_price ? `$${Number(drawerItem.original_price).toLocaleString('es-MX')}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Precio de venta">${Number(drawerItem.selling_price).toLocaleString('es-MX')} MXN</Descriptions.Item>
              <Descriptions.Item label="Pago a vendedora">${Number(drawerItem.seller_payout || 0).toLocaleString('es-MX')} MXN</Descriptions.Item>
              <Descriptions.Item label={drawerItem.no_seller ? 'Comisión (100%)' : 'Comisión (30%)'}>
                ${Number(drawerItem.commission || 0).toLocaleString('es-MX')} MXN
                {drawerItem.no_seller && <Tag color="blue" style={{ marginLeft: 6 }}>Ingreso total</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Vendedora">
                {drawerItem.no_seller
                  ? <Tag color="geekblue">Admin</Tag>
                  : drawerItem.seller_id && sellerMap[drawerItem.seller_id]
                    ? <a onClick={() => { setDrawerItem(null); navigate('/sellers') }}>
                        {sellerMap[drawerItem.seller_id].full_name} <LinkOutlined />
                      </a>
                    : '—'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Recibido">{drawerItem.received_at ? dayjs(drawerItem.received_at).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Publicado">
                {drawerItem.listed_at
                  ? `${dayjs(drawerItem.listed_at).format('DD/MM/YYYY')} (${daysAgo(drawerItem.listed_at)} días)`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Vendido">{drawerItem.sold_at ? dayjs(drawerItem.sold_at).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Notas">{drawerItem.notes || '—'}</Descriptions.Item>
            </Descriptions>

            <Divider />
            <Popconfirm
              title="¿Eliminar este artículo?"
              description="Esta acción no se puede deshacer."
              onConfirm={() => deleteMutation.mutate(drawerItem.id)}
              okText="Eliminar" okButtonProps={{ danger: true }}
              cancelText="Cancelar"
            >
              <Button
                danger block
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
              >
                Eliminar artículo
              </Button>
            </Popconfirm>
          </>
        )}
      </Drawer>

      {/* Stagnant items section */}
      {stagnant.length > 0 && (
        <Card
          style={{ marginTop: 20, borderRadius: 12, borderColor: '#ffccc7' }}
          title={
            <span>
              <WarningOutlined style={{ color: '#f5222d', marginRight: 6 }} />
              Artículos sin movimiento (+30 días publicados)
              <Tag color="red" style={{ marginLeft: 8 }}>{stagnant.length}</Tag>
            </span>
          }
        >
          <Table
            dataSource={stagnant}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: 'SKU', dataIndex: 'sku', width: 130,
                render: (v: string, r: any) => (
                  <a
                    style={{ color: '#1a3a6b', fontFamily: 'monospace' }}
                    onClick={() => {
                      const found = items.find((i: Item) => i.id === r.id)
                      if (found) setDrawerItem(found)
                    }}
                  >
                    {v} <ArrowRightOutlined style={{ fontSize: 10 }} />
                  </a>
                ),
              },
              { title: 'Artículo', dataIndex: 'title', ellipsis: true },
              { title: 'Categoría', dataIndex: 'category', width: 110, render: (v: string) => CATEGORY_LABEL[v] || v },
              { title: 'Precio', dataIndex: 'selling_price', width: 110, render: (v: number) => `$${Number(v).toLocaleString('es-MX')}` },
              {
                title: 'Días publicado', dataIndex: 'days_listed', width: 130,
                render: (v: number) => <Tag color="red">{v} días</Tag>,
              },
            ]}
          />
        </Card>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        title={editItem ? `Editar: ${editItem.title}` : 'Nuevo artículo'}
        onCancel={closeModal}
        footer={null} width={580}
      >
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="title" label="Título" rules={[{ required: true }]}>
            <Input placeholder="ej. Conjunto floral 3-6 meses Zara" />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="no_seller" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Checkbox>
              <Space size={4}>
                Sin vendedor
                <Text type="secondary" style={{ fontSize: 11 }}>(comisión 100% — sin pago a vendedora)</Text>
              </Space>
            </Checkbox>
          </Form.Item>
          <Form.Item shouldUpdate={(prev, cur) => prev.no_seller !== cur.no_seller} noStyle>
            {({ getFieldValue }) => !getFieldValue('no_seller') && (
              <Form.Item name="seller_id" label="Vendedora" rules={[{ required: !editItem }]}>
                <Select placeholder="Selecciona vendedora" disabled={!!editItem} showSearch optionFilterProp="label"
                  options={sellers.map(s => ({ value: s.id, label: `${s.full_name} (${s.phone})` }))} />
              </Form.Item>
            )}
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="category" label="Categoría" rules={[{ required: true }]}>
              <Select>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}</Select>
            </Form.Item>
            <Form.Item name="condition" label="Condición" rules={[{ required: true }]}>
              <Select>{Object.entries(CONDITION_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}</Select>
            </Form.Item>
            <Form.Item name="gender" label="Para">
              <Select allowClear placeholder="—">
                {Object.entries(GENDER_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
              </Select>
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="brand" label="Marca"><Input /></Form.Item>
            <Form.Item name="size" label="Talla"><Input placeholder="ej. 3-6m" /></Form.Item>
            <Form.Item name="measurements" label="Medidas"><Input placeholder="ej. 30x40cm" /></Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="color" label="Color"><Input /></Form.Item>
            <Form.Item name="usage_time" label="Tiempo de uso"><Input placeholder="ej. 6 meses" /></Form.Item>
            <Form.Item name="includes_manual" label="Incluye instructivo">
              <Select allowClear placeholder="—">
                <Option value={true}>Sí</Option>
                <Option value={false}>No</Option>
              </Select>
            </Form.Item>
          </Space>
          <Form.Item name="selling_price" label="Precio de venta ($)" rules={[{ required: true }]}>
            <InputNumber style={{ width: 200 }} min={0} prefix="$" />
          </Form.Item>
          <Form.Item name="seller_review" label="Reseña del vendedor">
            <Input.TextArea rows={2} placeholder="Descripción del estado según el vendedor…" />
          </Form.Item>
          <Form.Item name="notes" label="Notas internas">
            <Input.TextArea rows={2} />
          </Form.Item>

          {/* ── Photos ──────────────────────────────────────────────── */}
          <Divider style={{ margin: '4px 0 12px' }}>
            <Space size={6} style={{ color: '#1a3a6b', fontSize: 13 }}>
              <CameraOutlined />Fotos del artículo
            </Space>
          </Divider>

          {/* Existing photos (edit mode) */}
          {editItem && parseImages(editItem.images).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {parseImages(editItem.images).map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img
                    src={url} alt=""
                    style={{ width: 76, height: 95, objectFit: 'cover', borderRadius: 6, border: '1px solid #c8d8f0', display: 'block' }}
                  />
                  <Popconfirm
                    title="¿Eliminar esta foto?"
                    onConfirm={() => removeExistingPhoto(editItem, url)}
                    okText="Sí" cancelText="No"
                  >
                    <Button
                      size="small" danger type="text"
                      icon={<DeleteOutlined />}
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        background: 'rgba(255,255,255,0.85)', borderRadius: 4,
                        padding: '0 4px', minWidth: 0, lineHeight: 1,
                      }}
                    />
                  </Popconfirm>
                </div>
              ))}
            </div>
          )}

          {/* New photo picker */}
          {maxNewPhotos > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {fileList.map((f, i) => (
                <div key={f.uid} style={{ position: 'relative', width: 76, height: 95 }}>
                  <img
                    src={f.url} alt={f.name}
                    style={{ width: 76, height: 95, objectFit: 'cover', borderRadius: 6, border: '1px solid #c8d8f0', display: 'block' }}
                  />
                  <Button
                    size="small" danger type="text" icon={<DeleteOutlined />}
                    onClick={() => setFileList(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: '0 4px', minWidth: 0 }}
                  />
                </div>
              ))}
              {fileList.length < maxNewPhotos && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 76, height: 95, border: '1px dashed #1a3a6b', borderRadius: 6,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', background: '#f0f5ff',
                  }}
                >
                  <CameraOutlined style={{ fontSize: 22, color: '#1a3a6b' }} />
                  <div style={{ fontSize: 11, color: '#595959', marginTop: 4 }}>Agregar</div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  const remaining = maxNewPhotos - fileList.length
                  const newFiles = files.slice(0, remaining).map((file, i) => ({
                    uid: `pick-${Date.now()}-${i}`,
                    name: file.name,
                    url: URL.createObjectURL(file),
                    originFileObj: file,
                  }))
                  setFileList(prev => [...prev, ...newFiles].slice(0, maxNewPhotos))
                  e.target.value = ''
                }}
              />
            </div>
          )}
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, marginBottom: 16 }}>
            Máx. 6 fotos · Cloudinary aplica fondo blanco 4:5 automáticamente
          </Text>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button
              type="primary" htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending || uploadingImages}
              style={{ background: '#1a3a6b', borderColor: '#1a3a6b' }}
            >
              {editItem ? 'Guardar cambios' : 'Crear artículo'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
