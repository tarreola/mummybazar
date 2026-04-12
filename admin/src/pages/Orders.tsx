import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Modal, Form, Input, Select, Space, Typography,
  Tooltip, message, Tabs, Statistic, Row, Col, Card, Drawer,
  Descriptions, Steps, Divider, Popconfirm, Alert, AutoComplete,
} from 'antd'
import {
  EditOutlined, CheckCircleOutlined, WhatsAppOutlined, PlusOutlined,
  ShoppingCartOutlined, CarOutlined, GiftOutlined, DollarOutlined,
  ClockCircleOutlined, CloseCircleOutlined, SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getOrders, updateOrder, createOrder, getItems, getBuyers } from '../api/client'
import api from '../api/client'
import type { Order, OrderStatus, Item } from '../types'

const { Title, Text } = Typography
const { Option } = Select

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: 'orange',
  paid: 'blue',
  preparing: 'cyan',
  shipped: 'purple',
  delivered: 'purple',  // legacy — treated same as shipped
  closed: 'default',
  cancelled: 'red',
  refunded: 'default',
}
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Pago pendiente',
  paid: 'Compra realizada',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Enviado',  // legacy — display same as shipped
  closed: 'Cerrado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
}
// Max days allowed in each status before showing a warning
const STATUS_MAX_DAYS: Partial<Record<OrderStatus, number>> = {
  preparing: 3,
  shipped: 5,
}

const STATUS_ICON: Record<OrderStatus, React.ReactNode> = {
  pending_payment: <ClockCircleOutlined />,
  paid: <CheckCircleOutlined />,
  preparing: <GiftOutlined />,
  shipped: <CarOutlined />,
  delivered: <CheckCircleOutlined />,
  closed: <CloseCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
  refunded: <CloseCircleOutlined />,
}

// Main flow (non-terminal steps) — delivered removed, flow ends at shipped
const FLOW_STEPS: OrderStatus[] = ['pending_payment', 'paid', 'preparing', 'shipped']

const ACTIVE_STATUSES: OrderStatus[] = ['pending_payment', 'paid', 'preparing', 'shipped']

const TAB_GROUPS: { key: string; label: string; statuses: OrderStatus[]; pendingPayoutOnly?: boolean }[] = [
  { key: 'all',             label: 'Todos',                       statuses: ACTIVE_STATUSES },
  { key: 'pending_payment', label: 'Pago pendiente',              statuses: ['pending_payment'] },
  { key: 'paid',            label: 'Compra realizada',            statuses: ['paid'] },
  { key: 'preparing',       label: 'Preparando',                  statuses: ['preparing'] },
  { key: 'shipped',         label: 'Enviado',                     statuses: ['shipped'] },
  { key: 'pending_payout',  label: 'Pendiente pago vendedora',    statuses: ['shipped'], pendingPayoutOnly: true },
]

// ── Timing helper ─────────────────────────────────────────────────────────────
function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function StatusTimingBadge({ order }: { order: Order }) {
  const days = daysSince((order as any).status_changed_at || order.updated_at)
  const max = STATUS_MAX_DAYS[order.status]
  if (!days || ['closed', 'cancelled', 'refunded', 'delivered'].includes(order.status)) return null
  const over = max ? days > max : false
  const warn = max ? days === max : false
  return (
    <Tooltip title={`${days}d en este estado${over ? ' — ¡supera el máximo!' : ''}`}>
      <Tag
        color={over ? 'red' : warn ? 'orange' : 'default'}
        style={{ fontSize: 10, padding: '0 4px', marginLeft: 4, cursor: 'default' }}
      >
        {days}d
      </Tag>
    </Tooltip>
  )
}

const SHIPPING_LABEL: Record<string, string> = {
  pickup: 'Recoger en punto', delivery_cdmx: 'Entrega CDMX', parcel: 'Paquetería',
}

// ── Order timeline steps ───────────────────────────────────────────────────────
function OrderTimeline({ order }: { order: Order }) {
  const currentIdx = FLOW_STEPS.indexOf(order.status)
  const isClosed = ['cancelled', 'refunded', 'closed'].includes(order.status)

  if (isClosed) {
    const isCancel = order.status === 'cancelled' || order.status === 'refunded'
    return (
      <Alert
        type={isCancel ? 'error' : 'success'}
        message={`Orden ${STATUS_LABEL[order.status]}`}
        showIcon
        icon={isCancel ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
        style={{ marginBottom: 16 }}
      />
    )
  }

  const stepItems = FLOW_STEPS.map((s, i) => ({
    title: STATUS_LABEL[s],
    status: (
      i < currentIdx ? 'finish' :
      i === currentIdx ? 'process' : 'wait'
    ) as 'finish' | 'process' | 'wait',
    icon: STATUS_ICON[s],
    description: i === currentIdx ? <Tag color={STATUS_COLOR[s]}>Actual</Tag> : undefined,
  }))

  return (
    <Steps
      current={currentIdx}
      items={stepItems}
      direction="vertical"
      size="small"
      style={{ marginBottom: 16 }}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Orders() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('all')
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [needsTracking, setNeedsTracking] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<{ id: number; status: OrderStatus; order: Order } | null>(null)
  // Filters
  const [filterSearch, setFilterSearch] = useState('')
  // WhatsApp confirmation
  const [waConfirmOpen, setWaConfirmOpen] = useState(false)
  const [waPreview, setWaPreview] = useState<{ buyer?: string; seller?: string } | null>(null)
  const [pendingUpdate, setPendingUpdate] = useState<{ id: number; data: object } | null>(null)
  const [trackingForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [createForm] = Form.useForm()

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: allOrders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: () => getOrders().then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: listedItems = [] } = useQuery<Item[]>({
    queryKey: ['items', 'listed'],
    queryFn: () => getItems({ status: 'listed' }).then(r => r.data),
    enabled: createOpen,
  })

  const { data: buyerContacts = [] } = useQuery<any[]>({
    queryKey: ['buyers'],
    queryFn: () => getBuyers().then(r => r.data),
    enabled: createOpen,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => updateOrder(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      if (editOrder) setEditOrder(res.data)
      if (detailOrder) setDetailOrder(res.data)
      message.success('Pedido actualizado')
    },
    onError: () => message.error('Error al actualizar pedido'),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => createOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setCreateOpen(false)
      createForm.resetFields()
      message.success('Orden creada — WhatsApp enviado a compradora y vendedora')
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Error al crear orden'),
  })

  // ── WA status messages preview ────────────────────────────────────────────────
  const WA_MESSAGES: Partial<Record<OrderStatus, (o: Order) => { buyer?: string; seller?: string }>> = {
    paid: (o) => ({
      buyer: `¡Hola ${o.buyer_name || 'Clienta'}! ✅ Confirmamos tu compra de *${o.item_title}* (Orden: *${o.order_number}*). Te avisamos cuando esté listo para envío. 📦`,
    }),
    preparing: (o) => ({
      buyer: `¡Tu pedido *${o.order_number}* está siendo preparado! 📦 En máximo 3 días hábiles saldrá a tu domicilio. ¡Ya casi llega!`,
    }),
    shipped: (o) => ({
      buyer: `¡Tu pedido *${o.order_number}* ya va en camino! 🚚 Te compartiremos el número de rastreo en breve.`,
    }),
    cancelled: (o) => ({
      buyer: `Tu pedido *${o.order_number}* fue cancelado. El artículo vuelve al catálogo. Si tienes dudas, contáctanos. 🌸`,
    }),
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const changeStatus = (order: Order, status: OrderStatus) => {
    if (status === 'shipped') {
      setPendingStatus({ id: order.id, status, order })
      setNeedsTracking(true)
      trackingForm.resetFields()
      return
    }
    // Show WA confirmation if there's a message for this status
    const msgFn = WA_MESSAGES[status]
    if (msgFn) {
      const preview = msgFn(order)
      setWaPreview(preview)
      setPendingUpdate({ id: order.id, data: { status } })
      setWaConfirmOpen(true)
      return
    }
    updateMutation.mutate({ id: order.id, data: { status } })
  }

  const confirmWaAndUpdate = () => {
    if (!pendingUpdate) return
    updateMutation.mutate(pendingUpdate)
    setWaConfirmOpen(false)
    setPendingUpdate(null)
    setWaPreview(null)
  }

  const skipWaAndUpdate = () => {
    if (!pendingUpdate) return
    updateMutation.mutate(pendingUpdate)
    setWaConfirmOpen(false)
    setPendingUpdate(null)
    setWaPreview(null)
  }

  const confirmTracking = (values: any) => {
    if (!pendingStatus) return
    const data = { status: 'shipped', tracking_number: values.tracking_number, shipping_carrier: values.shipping_carrier }
    // Show WA preview for shipped
    const msgFn = WA_MESSAGES['shipped']
    if (msgFn && pendingStatus.order) {
      const preview = msgFn(pendingStatus.order)
      setWaPreview(preview)
      setPendingUpdate({ id: pendingStatus.id, data })
      setNeedsTracking(false)
      setPendingStatus(null)
      setWaConfirmOpen(true)
      return
    }
    updateMutation.mutate({ id: pendingStatus.id, data })
    setNeedsTracking(false)
    setPendingStatus(null)
  }

  const openEdit = (order: Order) => {
    setEditOrder(order)
    editForm.setFieldsValue({
      status: order.status, shipping_method: order.shipping_method,
      shipping_address: order.shipping_address, tracking_number: order.tracking_number,
      shipping_carrier: order.shipping_carrier, notes: order.notes,
    })
  }

  const onEditSave = (values: any) => {
    if (!editOrder) return
    if (values.status === 'shipped' && !values.tracking_number) {
      message.warning('Ingresa el número de rastreo antes de marcar como Enviado')
      return
    }
    updateMutation.mutate({ id: editOrder.id, data: values })
    setEditOrder(null)
  }

  // ── Filtered orders by tab + search ──────────────────────────────────────────
  const tabGroup = TAB_GROUPS.find(t => t.key === activeTab) ?? TAB_GROUPS[0]
  const orders = useMemo(() => {
    let result = allOrders.filter(o => tabGroup.statuses.includes(o.status))
    if (tabGroup.pendingPayoutOnly) result = result.filter(o => !o.seller_paid)

    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase()
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        (o.buyer_name || '').toLowerCase().includes(q) ||
        (o.seller_name || '').toLowerCase().includes(q) ||
        (o.item_title || '').toLowerCase().includes(q) ||
        (o.item_sku || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [allOrders, tabGroup, filterSearch])

  const tabCount = (t: typeof TAB_GROUPS[0]) => {
    const base = allOrders.filter(o => t.statuses.includes(o.status))
    return t.pendingPayoutOnly ? base.filter(o => !o.seller_paid).length : base.length
  }

  // ── Summary KPIs ──────────────────────────────────────────────────────────────
  const openOrders = allOrders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const confirmedOrders = allOrders.filter(o => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status))
  const totalRevenue = confirmedOrders.reduce((s, o) => s + Number(o.amount), 0)
  const totalCommission = confirmedOrders.reduce((s, o) => s + Number(o.commission_amount || 0), 0)
  const pendingCount = allOrders.filter(o => o.status === 'pending_payment').length
  const pendingPayouts = allOrders
    .filter(o => o.status === 'shipped' && !o.seller_paid)
    .reduce((s, o) => s + Number(o.seller_payout_amount), 0)

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns: ColumnsType<Order> = [
    {
      title: 'Pedido', dataIndex: 'order_number', width: 150,
      render: (v, r) => (
        <a style={{ color: '#1a3a6b', fontFamily: 'monospace', fontSize: 12 }}
          onClick={() => setDetailOrder(r)}>{v}</a>
      ),
    },
    {
      title: 'Artículo', dataIndex: 'item_title', ellipsis: true,
      render: (v, r) => (
        <div>
          <Text style={{ fontSize: 13 }}>{v || `Item #${r.item_id}`}</Text>
          {r.item_sku && <div><Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{r.item_sku}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Compradora', dataIndex: 'buyer_name',
      render: (v, r) => (
        <div>
          <Text style={{ fontSize: 13 }}>{v || `#${r.buyer_id}`}</Text>
          {r.buyer_phone && (
            <div>
              <a href={`https://wa.me/${r.buyer_phone.replace('+', '')}`} target="_blank" rel="noreferrer">
                <WhatsAppOutlined style={{ color: '#25d366', fontSize: 11, marginRight: 3 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>{r.buyer_phone}</Text>
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Total', dataIndex: 'amount', width: 110,
      render: v => <Text strong>${Number(v).toLocaleString('es-MX')}</Text>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 175,
      render: (v: OrderStatus, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Select
            size="small" value={v} style={{ width: 148 }}
            loading={updateMutation.isPending}
            onChange={(status: OrderStatus) => changeStatus(record, status)}
          >
            {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'closed' && k !== 'delivered').map(([k, label]) => (
              <Option key={k} value={k}>
                <Tag color={STATUS_COLOR[k as OrderStatus]} style={{ margin: 0, fontSize: 11 }}>
                  {label}
                </Tag>
              </Option>
            ))}
          </Select>
          <StatusTimingBadge order={record} />
        </div>
      ),
    },
    {
      title: 'Vendedora', dataIndex: 'seller_name', width: 130,
      render: (v, r) => <Text style={{ fontSize: 12 }}>{v || `#${r.seller_id}`}</Text>,
    },
    {
      title: 'Pago vendedora', dataIndex: 'seller_paid', width: 130,
      render: (v, r) => v
        ? <Tag color="green" icon={<CheckCircleOutlined />}>Pagado</Tag>
        : (
          <Tooltip title={r.status !== 'shipped' ? 'Disponible cuando el pedido está Enviado' : 'Confirmar pago — cerrará el pedido'}>
            <Button size="small" icon={<DollarOutlined />} type="dashed"
              disabled={r.status !== 'shipped'}
              onClick={() => updateMutation.mutate({ id: r.id, data: { seller_paid: 1 } })}>
              Pendiente
            </Button>
          </Tooltip>
        ),
    },
    { title: 'Fecha', dataIndex: 'created_at', width: 90, render: v => dayjs(v).format('DD/MM/YY') },
    {
      title: '', width: 60,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Detalle"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#1a3a6b', margin: 0 }}>Pedidos</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}
          style={{ background: '#1a3a6b', borderColor: '#1a3a6b' }}>
          Nueva orden
        </Button>
      </div>

      {/* KPI row */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        {[
          { title: 'Pedidos abiertos', value: openOrders.length },
          { title: 'Ventas confirmadas', value: `$${totalRevenue.toLocaleString('es-MX')}`, valueStyle: { color: '#389e0d' } },
          { title: 'Comisión', value: `$${totalCommission.toLocaleString('es-MX')}`, valueStyle: { color: '#1a3a6b' } },
          { title: 'Pago pendiente', value: pendingCount, valueStyle: pendingCount > 0 ? { color: '#f5222d' } : {} },
          { title: 'Pend. vendedoras', value: `$${pendingPayouts.toLocaleString('es-MX')}`, valueStyle: { color: '#d46b08' } },
        ].map(s => (
          <Col xs={12} sm={8} lg={Math.floor(24/5) as any} key={s.title} style={{ flex: 1 }}>
            <Card size="small" style={{ borderRadius: 8, borderColor: '#c8d8f0' }}>
              <Statistic title={<span style={{ fontSize: 11 }}>{s.title}</span>} value={s.value} valueStyle={{ fontSize: 16, ...(s.valueStyle || {}) }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Search + Tabs in one row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <Input
          placeholder="Buscar compradora, artículo, SKU…"
          prefix={<SearchOutlined style={{ color: '#1a3a6b' }} />}
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ flex: 1, marginBottom: 0 }}
          items={TAB_GROUPS.map(t => ({
            key: t.key,
            label: (
              <span>
                {t.label}
                <Tag style={{ marginLeft: 4, fontSize: 11 }}>{tabCount(t)}</Tag>
              </span>
            ),
          }))}
        />
      </div>

      <Table dataSource={orders} columns={columns} rowKey="id" loading={isLoading}
        size="small" pagination={{ pageSize: 20 }} scroll={{ x: 1100 }} />

      {/* ── Tracking modal (when changing to Enviado) ──────────────────────── */}
      <Modal
        open={needsTracking}
        title={<span><CarOutlined style={{ color: '#722ed1', marginRight: 8 }} />Información de envío</span>}
        onCancel={() => { setNeedsTracking(false); setPendingStatus(null) }}
        footer={null}
        width={420}
      >
        <Alert
          message="Se notificará a la compradora por WhatsApp con el número de rastreo."
          type="info" showIcon style={{ marginBottom: 16 }}
        />
        <Form form={trackingForm} layout="vertical" onFinish={confirmTracking}>
          <Form.Item name="shipping_carrier" label="Paquetería" rules={[{ required: true }]}>
            <Select placeholder="Selecciona">
              {['Estafeta', 'FedEx', 'DHL', 'AMPM', 'Paquetexpress', 'Otra'].map(c =>
                <Option key={c} value={c}>{c}</Option>
              )}
            </Select>
          </Form.Item>
          <Form.Item name="tracking_number" label="Número de rastreo" rules={[{ required: true }]}>
            <Input placeholder="Ej. 1234567890" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setNeedsTracking(false); setPendingStatus(null) }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<WhatsAppOutlined />}
              loading={updateMutation.isPending}
              style={{ background: '#25d366', borderColor: '#25d366' }}>
              Confirmar y notificar
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Order detail drawer ───────────────────────────────────────────────── */}
      <Drawer
        title={detailOrder ? `Pedido ${detailOrder.order_number}` : ''}
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        width={460}
      >
        {detailOrder && (
          <>
            <OrderTimeline order={detailOrder} />
            <Divider style={{ margin: '12px 0' }} />

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Artículo">
                <Text strong>{detailOrder.item_title}</Text>
                {detailOrder.item_sku && (
                  <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 11, marginLeft: 8 }}>
                    {detailOrder.item_sku}
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Compradora">
                {detailOrder.buyer_name}
                {detailOrder.buyer_phone && (
                  <a href={`https://wa.me/${detailOrder.buyer_phone.replace('+', '')}`}
                    target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>
                    <WhatsAppOutlined style={{ color: '#25d366' }} />
                  </a>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Vendedora">{detailOrder.seller_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong style={{ color: '#1a3a6b' }}>
                  ${Number(detailOrder.amount).toLocaleString('es-MX')} MXN
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Comisión (30%)">
                <Text style={{ color: '#389e0d' }}>
                  ${Number(detailOrder.commission_amount).toLocaleString('es-MX')} MXN
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Pago a vendedora">
                <Text style={{ color: '#d46b08' }}>
                  ${Number(detailOrder.seller_payout_amount).toLocaleString('es-MX')} MXN
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Envío">
                {detailOrder.shipping_method ? SHIPPING_LABEL[detailOrder.shipping_method] || detailOrder.shipping_method : '—'}
              </Descriptions.Item>
              {detailOrder.tracking_number && (
                <Descriptions.Item label="Rastreo">
                  <code>{detailOrder.tracking_number}</code>
                  {detailOrder.shipping_carrier && <Text type="secondary" style={{ marginLeft: 6 }}>({detailOrder.shipping_carrier})</Text>}
                </Descriptions.Item>
              )}
              {detailOrder.shipping_address && (
                <Descriptions.Item label="Dirección">{detailOrder.shipping_address}</Descriptions.Item>
              )}
              <Descriptions.Item label="Pago vendedora">
                {detailOrder.seller_paid
                  ? <Tag color="green" icon={<CheckCircleOutlined />}>Pagado {detailOrder.seller_paid_at ? dayjs(detailOrder.seller_paid_at).format('DD/MM/YY') : ''}</Tag>
                  : <Tag color="orange">Pendiente</Tag>
                }
              </Descriptions.Item>
              {detailOrder.notes && (
                <Descriptions.Item label="Notas">{detailOrder.notes}</Descriptions.Item>
              )}
              <Descriptions.Item label="Creado">{dayjs(detailOrder.created_at).format('DD/MM/YY HH:mm')}</Descriptions.Item>
            </Descriptions>

            {/* Quick actions */}
            <Divider style={{ margin: '16px 0 8px' }}>Acciones rápidas</Divider>
            <Space wrap>
              {detailOrder.status === 'pending_payment' && (
                <Button size="small" type="primary"
                  style={{ background: '#096dd9', borderColor: '#096dd9' }}
                  onClick={() => changeStatus(detailOrder, 'paid')}>
                  Marcar pagado
                </Button>
              )}
              {detailOrder.status === 'paid' && (
                <Button size="small" type="primary"
                  style={{ background: '#13c2c2', borderColor: '#13c2c2' }}
                  onClick={() => changeStatus(detailOrder, 'preparing')}>
                  En preparación
                </Button>
              )}
              {detailOrder.status === 'preparing' && (
                <Button size="small" type="primary"
                  style={{ background: '#722ed1', borderColor: '#722ed1' }}
                  onClick={() => changeStatus(detailOrder, 'shipped')}>
                  Marcar enviado
                </Button>
              )}
              {detailOrder.status === 'shipped' && !detailOrder.seller_paid && (
                <Popconfirm
                  title="¿Registrar pago a vendedora?"
                  description="El pedido se cerrará automáticamente al confirmar el pago."
                  onConfirm={() => updateMutation.mutate({ id: detailOrder.id, data: { seller_paid: 1 } })}
                  okText="Confirmar pago" cancelText="No"
                >
                  <Button size="small" icon={<DollarOutlined />} type="primary"
                    style={{ background: '#d46b08', borderColor: '#d46b08' }}>
                    Registrar pago a vendedora
                  </Button>
                </Popconfirm>
              )}
              {['pending_payment', 'paid', 'preparing'].includes(detailOrder.status) && (
                <Popconfirm
                  title="¿Cancelar esta orden?"
                  description="El artículo volverá al inventario como 'Publicado'."
                  onConfirm={() => changeStatus(detailOrder, 'cancelled')}
                  okText="Cancelar orden" cancelText="No"
                >
                  <Button size="small" danger>Cancelar orden</Button>
                </Popconfirm>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* ── Edit modal ────────────────────────────────────────────────────────── */}
      <Modal open={!!editOrder} title={`Editar: ${editOrder?.order_number}`}
        onCancel={() => setEditOrder(null)} footer={null} width={480}>
        <Form form={editForm} layout="vertical" onFinish={onEditSave}>
          <Form.Item name="status" label="Estado del pedido">
            <Select>
              {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'delivered').map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="shipping_method" label="Método de envío">
            <Select allowClear>
              <Option value="pickup">Recoger en punto</Option>
              <Option value="delivery_cdmx">Entrega CDMX</Option>
              <Option value="parcel">Paquetería</Option>
            </Select>
          </Form.Item>
          <Form.Item name="shipping_address" label="Dirección de entrega">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="shipping_carrier" label="Paquetería"><Input placeholder="Estafeta, FedEx…" /></Form.Item>
            <Form.Item name="tracking_number" label="Número de rastreo"><Input /></Form.Item>
          </Space>
          <Form.Item name="notes" label="Notas"><Input.TextArea rows={2} /></Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setEditOrder(null)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending}
              style={{ background: '#1a3a6b', borderColor: '#1a3a6b' }}>Guardar</Button>
          </div>
        </Form>
      </Modal>

      {/* ── WhatsApp confirmation modal ───────────────────────────────────────── */}
      <Modal
        open={waConfirmOpen}
        title={<span><WhatsAppOutlined style={{ color: '#25d366', marginRight: 8 }} />Confirmar notificaciones WhatsApp</span>}
        onCancel={skipWaAndUpdate}
        footer={null}
        width={480}
      >
        <Alert
          message="Se enviarán los siguientes mensajes al actualizar el pedido."
          type="info" showIcon style={{ marginBottom: 16 }}
        />
        {waPreview?.buyer && (
          <Card size="small" style={{ marginBottom: 10, borderColor: '#25d366', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>📱 Mensaje a compradora:</Text>
            <p style={{ margin: '6px 0 0', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{waPreview.buyer}</p>
          </Card>
        )}
        {waPreview?.seller && (
          <Card size="small" style={{ marginBottom: 10, borderColor: '#096dd9', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>📱 Mensaje a vendedora:</Text>
            <p style={{ margin: '6px 0 0', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{waPreview.seller}</p>
          </Card>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={skipWaAndUpdate}>Actualizar sin WhatsApp</Button>
          <Button
            type="primary" icon={<WhatsAppOutlined />}
            onClick={confirmWaAndUpdate}
            loading={updateMutation.isPending}
            style={{ background: '#25d366', borderColor: '#25d366' }}
          >
            Confirmar y enviar WhatsApp
          </Button>
        </div>
      </Modal>

      {/* ── Nueva Orden modal ─────────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        title={<span><ShoppingCartOutlined style={{ color: '#1a3a6b', marginRight: 8 }} />Nueva orden (venta manual)</span>}
        onCancel={() => { setCreateOpen(false); createForm.resetFields() }}
        footer={null}
        width={520}
      >
        <Alert
          message="Al crear la orden: el artículo pasa a 'Vendido', se notifica a la compradora y vendedora por WhatsApp."
          type="info" showIcon style={{ marginBottom: 16 }}
        />
        <Form form={createForm} layout="vertical"
          onFinish={v => createMutation.mutate(v)}>

          <Divider style={{ margin: '4px 0 12px' }}>Datos de la compradora</Divider>

          {/* Phone with autocomplete from contact DB */}
          <Form.Item name="buyer_phone" label="WhatsApp / Teléfono" rules={[{ required: true, message: 'Requerido' }]}
            extra="Si ya existe en la base de contactos, se autocompletará.">
            <AutoComplete
              placeholder="+525512345678"
              options={buyerContacts.map(b => ({
                value: b.phone,
                label: `${b.phone} — ${b.full_name}`,
              }))}
              filterOption={(input, opt) =>
                (opt?.value || '').includes(input) || (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())
              }
              onSelect={(phone: string) => {
                const match = buyerContacts.find(b => b.phone === phone)
                if (match) createForm.setFieldsValue({
                  buyer_name: match.full_name,
                  buyer_whatsapp: match.whatsapp || match.phone,
                  buyer_email: match.email || undefined,
                })
              }}
            />
          </Form.Item>

          <Form.Item name="buyer_name" label="Nombre completo" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="María González" />
          </Form.Item>

          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="buyer_whatsapp" label="WhatsApp (si diferente)">
              <Input placeholder="+525512345678" />
            </Form.Item>
            <Form.Item name="buyer_email" label="Email">
              <Input placeholder="maria@email.com" />
            </Form.Item>
          </Space>

          <Divider style={{ margin: '4px 0 12px' }}>Artículo y envío</Divider>

          <Form.Item name="item_id" label="Artículo (solo publicados)" rules={[{ required: true, message: 'Selecciona un artículo' }]}>
            <Select showSearch optionFilterProp="label" placeholder="Buscar artículo…"
              options={listedItems.map(i => ({ value: i.id, label: `${i.sku} — ${i.title} ($${Number(i.selling_price).toLocaleString('es-MX')})` }))} />
          </Form.Item>
          <Form.Item name="shipping_method" label="Método de envío">
            <Select allowClear>
              <Option value="pickup">Recoger en punto</Option>
              <Option value="delivery_cdmx">Entrega CDMX</Option>
              <Option value="parcel">Paquetería</Option>
            </Select>
          </Form.Item>
          <Form.Item name="shipping_address" label="Dirección de entrega">
            <Input.TextArea rows={2} placeholder="Calle, colonia, ciudad, CP…" />
          </Form.Item>
          <Form.Item name="notes" label="Notas internas">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setCreateOpen(false); createForm.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}
              icon={<WhatsAppOutlined />}
              style={{ background: '#1a3a6b', borderColor: '#1a3a6b' }}>
              Crear orden y notificar
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
