import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Modal, Form, Input, Select, Space, Typography,
  Tooltip, message, Tabs, Statistic, Row, Col, Card, Drawer,
  Descriptions, Steps, Divider, Badge, Popconfirm, Alert,
} from 'antd'
import {
  EditOutlined, CheckCircleOutlined, WhatsAppOutlined, PlusOutlined,
  ShoppingCartOutlined, CarOutlined, GiftOutlined, DollarOutlined,
  ClockCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getOrders, updateOrder, createOrder, getItems, getBuyers } from '../api/client'
import type { Order, OrderStatus, Item, Buyer } from '../types'

const { Title, Text } = Typography
const { Option } = Select

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: 'orange', paid: 'blue', preparing: 'cyan',
  shipped: 'purple', delivered: 'green', cancelled: 'red', refunded: 'default',
}
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Pago pendiente', paid: 'Pagado', preparing: 'Preparando',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado',
}
const STATUS_ICON: Record<OrderStatus, React.ReactNode> = {
  pending_payment: <ClockCircleOutlined />,
  paid: <CheckCircleOutlined />,
  preparing: <GiftOutlined />,
  shipped: <CarOutlined />,
  delivered: <CheckCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
  refunded: <CloseCircleOutlined />,
}

const FLOW_STEPS: OrderStatus[] = ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered']

const TAB_GROUPS = [
  { key: 'all', label: 'Todos', statuses: [] as OrderStatus[] },
  { key: 'active', label: 'Activos', statuses: ['pending_payment', 'paid', 'preparing'] as OrderStatus[] },
  { key: 'shipped', label: 'Enviados', statuses: ['shipped'] as OrderStatus[] },
  { key: 'delivered', label: 'Entregados', statuses: ['delivered'] as OrderStatus[] },
  { key: 'closed', label: 'Cerrados', statuses: ['cancelled', 'refunded'] as OrderStatus[] },
]

const SHIPPING_LABEL: Record<string, string> = {
  pickup: 'Recoger en punto', delivery_cdmx: 'Entrega CDMX', parcel: 'Paquetería',
}

// ── Order timeline steps ───────────────────────────────────────────────────────
function OrderTimeline({ order }: { order: Order }) {
  const currentIdx = FLOW_STEPS.indexOf(order.status)
  const isClosed = order.status === 'cancelled' || order.status === 'refunded'

  if (isClosed) {
    return (
      <Alert
        type="error"
        message={`Orden ${STATUS_LABEL[order.status]}`}
        showIcon
        icon={<CloseCircleOutlined />}
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
  const [pendingStatus, setPendingStatus] = useState<{ id: number; status: OrderStatus } | null>(null)
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

  const { data: buyers = [] } = useQuery<Buyer[]>({
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
      message.success('Pedido actualizado — WhatsApp enviado automáticamente')
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

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const changeStatus = (order: Order, status: OrderStatus) => {
    if (status === 'shipped') {
      // Ask for tracking number first
      setPendingStatus({ id: order.id, status })
      setNeedsTracking(true)
      trackingForm.resetFields()
      return
    }
    updateMutation.mutate({ id: order.id, data: { status } })
  }

  const confirmTracking = (values: any) => {
    if (!pendingStatus) return
    updateMutation.mutate({
      id: pendingStatus.id,
      data: { status: 'shipped', tracking_number: values.tracking_number, shipping_carrier: values.shipping_carrier },
    })
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

  // ── Filtered orders by tab ────────────────────────────────────────────────────
  const tabGroup = TAB_GROUPS.find(t => t.key === activeTab)!
  const orders = tabGroup.statuses.length
    ? allOrders.filter(o => tabGroup.statuses.includes(o.status))
    : allOrders

  // ── Summary KPIs ──────────────────────────────────────────────────────────────
  const confirmedOrders = allOrders.filter(o => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status))
  const totalRevenue = confirmedOrders.reduce((s, o) => s + Number(o.amount), 0)
  const pendingCount = allOrders.filter(o => o.status === 'pending_payment').length
  const pendingPayouts = allOrders
    .filter(o => o.status === 'delivered' && !o.seller_paid)
    .reduce((s, o) => s + Number(o.seller_payout_amount), 0)

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns: ColumnsType<Order> = [
    {
      title: 'Pedido', dataIndex: 'order_number', width: 150,
      render: (v, r) => (
        <a style={{ color: '#c41d7f', fontFamily: 'monospace', fontSize: 12 }}
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
      title: 'Estado', dataIndex: 'status', width: 145,
      render: (v: OrderStatus, record) => (
        <Select
          size="small" value={v} style={{ width: 138 }}
          loading={updateMutation.isPending}
          onChange={(status: OrderStatus) => changeStatus(record, status)}
        >
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <Option key={k} value={k}>
              <Tag color={STATUS_COLOR[k as OrderStatus]} style={{ margin: 0, fontSize: 11 }}>
                {label}
              </Tag>
            </Option>
          ))}
        </Select>
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
          <Tooltip title={r.status !== 'delivered' ? 'Solo disponible cuando orden entregada' : 'Marcar pago realizado'}>
            <Button size="small" icon={<DollarOutlined />} type="dashed"
              disabled={r.status !== 'delivered'}
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
        <Title level={4} style={{ color: '#c41d7f', margin: 0 }}>Pedidos</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}
          style={{ background: '#c41d7f', borderColor: '#c41d7f' }}>
          Nueva orden
        </Button>
      </div>

      {/* KPI row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: 'Total pedidos', value: allOrders.length },
          { title: 'Ventas confirmadas', value: `$${totalRevenue.toLocaleString('es-MX')}`, valueStyle: { color: '#389e0d' } },
          { title: 'Pago pendiente', value: pendingCount, valueStyle: pendingCount > 0 ? { color: '#f5222d' } : {} },
          { title: 'Pagos pendientes a vendedoras', value: `$${pendingPayouts.toLocaleString('es-MX')}`, valueStyle: { color: '#d46b08' } },
        ].map(s => (
          <Col xs={12} lg={6} key={s.title}>
            <Card size="small" style={{ borderRadius: 10, borderColor: '#ffe0f0' }}>
              <Statistic title={s.title} value={s.value} valueStyle={{ fontSize: 18, ...(s.valueStyle || {}) }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}
        items={TAB_GROUPS.map(t => ({
          key: t.key,
          label: (
            <span>
              {t.label}
              <Tag style={{ marginLeft: 6, fontSize: 11 }}>
                {t.statuses.length ? allOrders.filter(o => t.statuses.includes(o.status)).length : allOrders.length}
              </Tag>
            </span>
          ),
        }))}
      />

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
                <Text strong style={{ color: '#c41d7f' }}>
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
              {detailOrder.status === 'shipped' && (
                <Button size="small" type="primary"
                  style={{ background: '#389e0d', borderColor: '#389e0d' }}
                  onClick={() => changeStatus(detailOrder, 'delivered')}>
                  Confirmar entregado
                </Button>
              )}
              {detailOrder.status === 'delivered' && !detailOrder.seller_paid && (
                <Button size="small" icon={<DollarOutlined />}
                  onClick={() => updateMutation.mutate({ id: detailOrder.id, data: { seller_paid: 1 } })}>
                  Registrar pago a vendedora
                </Button>
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
              {Object.entries(STATUS_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
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
              style={{ background: '#c41d7f', borderColor: '#c41d7f' }}>Guardar</Button>
          </div>
        </Form>
      </Modal>

      {/* ── Nueva Orden modal ─────────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        title={<span><ShoppingCartOutlined style={{ color: '#c41d7f', marginRight: 8 }} />Nueva orden (venta manual)</span>}
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
          <Form.Item name="buyer_id" label="Compradora" rules={[{ required: true, message: 'Selecciona una compradora' }]}>
            <Select showSearch optionFilterProp="label" placeholder="Buscar compradora…"
              options={buyers.map(b => ({ value: b.id, label: `${b.full_name} (${b.phone})` }))} />
          </Form.Item>
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
              style={{ background: '#c41d7f', borderColor: '#c41d7f' }}>
              Crear orden y notificar
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
