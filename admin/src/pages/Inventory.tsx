import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Modal, Form, Input, Select, InputNumber,
  Space, Typography, Tooltip, message, Drawer, Descriptions, Popconfirm,
  Upload, Image, Divider, Progress, Alert, Card, Checkbox,
} from 'antd'
import {
  PlusOutlined, EditOutlined, StopOutlined, LinkOutlined,
  ClockCircleOutlined, CameraOutlined, DeleteOutlined, WarningOutlined,
  ArrowRightOutlined, FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getItems, createItem, updateItem, getSellers, uploadItemImage, deleteItemImage } from '../api/client'
import api from '../api/client'
import type { Item, ItemStatus, Seller } from '../types'
import { enhanceImage } from '../hooks/useImageEnhance'
import type { EnhanceStatus } from '../hooks/useImageEnhance'

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
  girl: 'Niña', boy: 'Niño', unisex: 'Unisex',
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
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceStatus, setEnhanceStatus] = useState<EnhanceStatus>('idle')
  const [enhanceProgress, setEnhanceProgress] = useState(0)
  const [showClosed, setShowClosed] = useState(false)
  const [filterCategories, setFilterCategories] = useState<string[]>([])
  const [noSellerFilter, setNoSellerFilter] = useState(false)
  const [form] = Form.useForm()

  // Process a batch of raw files through the AI pipeline
  const processFiles = async (rawFiles: File[]): Promise<UploadFile[]> => {
    if (rawFiles.length === 0) return []
    setEnhancing(true)
    setEnhanceProgress(0)
    const results: UploadFile[] = []
    for (let i = 0; i < rawFiles.length; i++) {
      const raw = rawFiles[i]
      try {
        setEnhanceStatus('removing-bg')
        const { file: enhanced, preview } = await enhanceImage(raw, setEnhanceStatus)
        results.push({
          uid: `enhanced-${Date.now()}-${i}`,
          name: enhanced.name,
          status: 'done',
          originFileObj: enhanced as any,
          url: preview,
          thumbUrl: preview,
        })
      } catch (err) {
        console.error('Enhancement failed for', raw.name, err)
        // Fallback: use original file without processing
        const fallbackUrl = URL.createObjectURL(raw)
        results.push({
          uid: `raw-${Date.now()}-${i}`,
          name: raw.name,
          status: 'done',
          originFileObj: raw as any,
          url: fallbackUrl,
          thumbUrl: fallbackUrl,
        })
        message.warning(`No se pudo procesar "${raw.name}", se usará la foto original.`)
      }
      setEnhanceProgress(Math.round(((i + 1) / rawFiles.length) * 100))
    }
    setEnhancing(false)
    setEnhanceStatus('done')
    return results
  }

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

  const uploadPending = async (itemId: number) => {
    for (const f of fileList) {
      if (f.originFileObj) await uploadItemImage(itemId, f.originFileObj)
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: object) => createItem(data),
    onSuccess: async (res) => {
      const id = res.data.id
      if (fileList.length > 0) {
        setUploadingImages(true)
        try { await uploadPending(id) } finally { setUploadingImages(false) }
      }
      qc.invalidateQueries({ queryKey: ['items'] })
      setModalOpen(false)
      setFileList([])
      form.resetFields()
      message.success('Artículo creado')
    },
    onError: () => message.error('Error al guardar artículo'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => updateItem(id, data),
    onSuccess: async (res) => {
      const id = res.data.id
      if (fileList.length > 0) {
        setUploadingImages(true)
        try { await uploadPending(id) } finally { setUploadingImages(false) }
      }
      qc.invalidateQueries({ queryKey: ['items'] })
      setModalOpen(false)
      setFileList([])
    },
    onError: () => message.error('Error al actualizar'),
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
    if (editItem) updateMutation.mutate({ id: editItem.id, data: values })
    else createMutation.mutate(values)
  }

  const markSoldOffPlatform = (item: Item) => {
    updateMutation.mutate({ id: item.id, data: { status: 'archived', notes: (item.notes || '') + '\n[Vendido fuera de plataforma]' } })
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
        <a style={{ color: '#c41d7f', fontFamily: 'monospace' }} onClick={() => setDrawerItem(r)}>{v}</a>
      ),
    },
    {
      title: 'Foto', dataIndex: 'images', width: 60,
      render: (v) => {
        const [first] = parseImages(v)
        return first
          ? <Image src={first} width={40} height={50} style={{ objectFit: 'cover', borderRadius: 4 }} preview={{ mask: false }} />
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
      render: v => {
        const s = sellerMap[v]
        return s ? <Text style={{ fontSize: 12 }}>{s.full_name}</Text> : `#${v}`
      },
      filters: sellers.map(s => ({ text: s.full_name, value: s.id })),
      onFilter: (value, record) => record.seller_id === value,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 150,
      render: (v: ItemStatus, record) => (
        <Select
          size="small" value={v} style={{ width: 140 }}
          onChange={(status) => updateMutation.mutate({ id: record.id, data: { status } })}
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
          <Title level={4} style={{ color: '#c41d7f', margin: 0 }}>Inventario</Title>
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
            style={{ background: '#c41d7f', borderColor: '#c41d7f' }}>
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
              style={{ borderColor: '#c41d7f', color: '#c41d7f' }}
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
                        style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #ffe0f0', cursor: 'zoom-in' }}
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
              {drawerItem.no_seller && <Descriptions.Item label="Sin vendedor"><Tag color="purple">100% comisión</Tag></Descriptions.Item>}
              <Descriptions.Item label="Marca">{drawerItem.brand || '—'}</Descriptions.Item>
              <Descriptions.Item label="Talla">{drawerItem.size || '—'}</Descriptions.Item>
              <Descriptions.Item label="Color">{drawerItem.color || '—'}</Descriptions.Item>
              <Descriptions.Item label="Precio original">{drawerItem.original_price ? `$${Number(drawerItem.original_price).toLocaleString('es-MX')}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Precio de venta">${Number(drawerItem.selling_price).toLocaleString('es-MX')} MXN</Descriptions.Item>
              <Descriptions.Item label="Pago a vendedora">${Number(drawerItem.seller_payout || 0).toLocaleString('es-MX')} MXN</Descriptions.Item>
              <Descriptions.Item label="Comisión (30%)">${Number(drawerItem.commission || 0).toLocaleString('es-MX')} MXN</Descriptions.Item>
              <Descriptions.Item label="Vendedora">
                {drawerItem.no_seller
                  ? <Tag color="purple">Sin vendedor</Tag>
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
                    style={{ color: '#c41d7f', fontFamily: 'monospace' }}
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
            <Form.Item name="gender" label="Género">
              <Select allowClear placeholder="—">
                {Object.entries(GENDER_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
              </Select>
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="brand" label="Marca"><Input /></Form.Item>
            <Form.Item name="size" label="Talla"><Input placeholder="ej. 3-6m" /></Form.Item>
            <Form.Item name="color" label="Color"><Input /></Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="original_price" label="Precio original ($)">
              <InputNumber style={{ width: '100%' }} min={0} prefix="$" />
            </Form.Item>
            <Form.Item name="selling_price" label="Precio de venta ($)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} prefix="$" />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label="Notas internas">
            <Input.TextArea rows={2} />
          </Form.Item>

          {/* ── Photos ──────────────────────────────────────────────── */}
          <Divider style={{ margin: '4px 0 12px' }}>
            <Space size={6} style={{ color: '#c41d7f', fontSize: 13 }}>
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
                    style={{ width: 76, height: 95, objectFit: 'cover', borderRadius: 6, border: '1px solid #ffe0f0', display: 'block' }}
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

          {/* New photo picker — AI enhanced */}
          {maxNewPhotos > 0 && (
            <>
              <Upload
                listType="picture-card"
                fileList={fileList}
                accept="image/*"
                multiple
                showUploadList={{ showPreviewIcon: true, showRemoveIcon: !enhancing }}
                beforeUpload={() => false}
                onChange={({ fileList: fl }) => {
                  // Only handle removals here (additions are handled via customRequest)
                  if (fl.length < fileList.length) setFileList(fl)
                }}
                customRequest={async ({ file, onSuccess }) => {
                  const raw = file as File
                  const remaining = maxNewPhotos - fileList.length
                  if (remaining <= 0) return
                  const processed = await processFiles([raw])
                  setFileList(prev => [...prev, ...processed].slice(0, maxNewPhotos))
                  onSuccess?.('ok')
                }}
                disabled={enhancing}
              >
                {fileList.length < maxNewPhotos && !enhancing && (
                  <div>
                    <CameraOutlined style={{ fontSize: 22, color: '#c41d7f' }} />
                    <div style={{ marginTop: 6, fontSize: 12, color: '#595959' }}>
                      Agregar foto
                    </div>
                  </div>
                )}
              </Upload>

              {enhancing && (
                <div style={{ margin: '8px 0' }}>
                  <Progress
                    percent={enhanceProgress}
                    status="active"
                    strokeColor="#c41d7f"
                    format={() => (
                      <span style={{ fontSize: 11, color: '#c41d7f' }}>
                        {enhanceStatus === 'removing-bg' ? 'Quitando fondo…' : 'Componiendo…'}
                      </span>
                    )}
                  />
                </div>
              )}
            </>
          )}
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, marginBottom: 16 }}>
            Máx. 6 fotos · IA elimina fondo → fondo blanco 4:5 · marca de agua MommyBazar
          </Text>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button
              type="primary" htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending || uploadingImages}
              disabled={enhancing}
              style={{ background: '#c41d7f', borderColor: '#c41d7f' }}
            >
              {enhancing ? 'Procesando fotos…' : editItem ? 'Guardar cambios' : 'Crear artículo'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
