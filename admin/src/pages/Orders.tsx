import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Modal, Form, Input, Select, Space, Typography,
  Tooltip, message, Tabs, Statistic, Row, Col, Card,
} from 'antd'
import { EditOutlined, CheckCircleOutlined, WhatsAppOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getOrders, updateOrder } from '../api/client'
import api from '../api/client'
import type { Order, OrderStatus } from '../types'

const { Title, Text } = Typography
const { Option } = Select

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: 'orange', paid: 'blue', preparing: 'cyan',
  shipped: 'purple', delivered: 'green', cancelled: 'red', refunded: 'default',
}
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Pago pendiente', paid: 'Pagado', preparing: 'Preparando',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado',
}
const TAB_GROUPS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: 'all', label: 'Todos', statuses: [] },
  { key: 'active', label: 'Activos', statuses: ['pending_payment', 'paid', 'preparing'] },
  { key: 'shipped', label: 'Enviados', statuses: ['shipped'] },
  { key: 'delivered', label: 'Entregados', statuses: ['delivered'] },
  { key: 'done', label: 'Cerrados', statuses: ['cancelled', 'refunded'] },
]

export default function Orders() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('all')
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [form] = Form.useForm()

  const { data: allOrders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: () => getOrders().then(r => r.data),
    refetchInterval: 30_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => updateOrder(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setEditOrder(null) },
    onError: () => message.error('Error al actualizar pedido'),
  })

  const notifyMutation = useMutation({
    mutationFn: (orderId: number) => api.post(`/whatsapp/notify-order-status/${orderId}`),
    onSuccess: () => message.success('Notificación enviada por WhatsApp'),
    onError: () => message.error('Error al notificar (revisa credenciales de Twilio)'),
  })

  const openEdit = (order: Order) => {
    setEditOrder(order)
    form.setFieldsValue({
      status: order.status, shipping_method: order.shipping_method,
      shipping_address: order.shipping_address, tracking_number: order.tracking_number,
      shipping_carrier: order.shipping_carrier, notes: order.notes,
    })
  }
  const onSave = (values: object) => {
    if (editOrder) updateMutation.mutate({ id: editOrder.id, data: values })
  }

  // Filter by tab
  const tabGroup = TAB_GROUPS.find(t => t.key === activeTab)!
  const orders = tabGroup.statuses.length
    ? allOrders.filter(o => tabGroup.statuses.includes(o.status))
    : allOrders

  // Summary stats
  const totalRevenue = allOrders.filter(o => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.amount), 0)
  const pendingCount = allOrders.filter(o => o.status === 'pending_payment').length
  const pendingPayouts = allOrders.filter(o => o.status === 'delivered' && !o.seller_paid)
    .reduce((sum, o) => sum + Number(o.seller_payout_amount), 0)

  const columns: ColumnsType<Order> = [
    {
      title: 'Pedido', dataIndex: 'order_number', width: 140,
      render: v => <code style={{ color: '#c41d7f', fontSize: 12 }}>{v}</code>,
    },
    { title: 'Item', dataIndex: 'item_id', width: 60 },
    { title: 'Compradora', dataIndex: 'buyer_id', width: 90 },
    {
      title: 'Total', dataIndex: 'amount', width: 110,
      render: v => <Text strong>${Number(v).toLocaleString('es-MX')}</Text>,
    },
    {
      title: 'Comisión', dataIndex: 'commission_amount', width: 95,
      render: v => <Text style={{ color: '#389e0d' }}>${Number(v).toLocaleString('es-MX')}</Text>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 140,
      render: (v: OrderStatus) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: 'Rastreo', dataIndex: 'tracking_number', width: 120,
      render: (v, r) => v ? <Tooltip title={r.shipping_carrier || ''}><code>{v}</code></Tooltip> : '—',
    },
    {
      title: 'Pago vendedora', dataIndex: 'seller_paid', width: 120,
      render: (v, r) => v
        ? <Tag color="green">Pagado</Tag>
        : (
          <Tooltip title="Marcar como pagado a vendedora">
            <Button size="small" icon={<CheckCircleOutlined />} type="dashed"
              onClick={() => updateMutation.mutate({ id: r.id, data: { seller_paid: 1 } })}
              disabled={r.status !== 'delivered'}>
              Pendiente
            </Button>
          </Tooltip>
        ),
    },
    { title: 'Fecha', dataIndex: 'created_at', width: 90, render: v => dayjs(v).format('DD/MM/YY') },
    {
      title: '', width: 70,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Notificar por WhatsApp">
            <Button size="small" icon={<WhatsAppOutlined />}
              style={{ borderColor: '#25d366', color: '#25d366' }}
              onClick={() => notifyMutation.mutate(r.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ color: '#c41d7f', marginBottom: 16 }}>Pedidos</Title>

      {/* Summary row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: 'Total pedidos', value: allOrders.length },
          { title: 'Ventas confirmadas', value: `$${totalRevenue.toLocaleString('es-MX')}`, valueStyle: { color: '#389e0d' } },
          { title: 'Pagos pendientes', value: pendingCount, valueStyle: pendingCount > 0 ? { color: '#f5222d' } : {} },
          { title: 'Pagos pendientes a vendedoras', value: `$${pendingPayouts.toLocaleString('es-MX')}`, valueStyle: { color: '#d46b08' } },
        ].map(s => (
          <Col xs={12} lg={6} key={s.title}>
            <Card size="small" style={{ borderRadius: 10, borderColor: '#ffe0f0' }}>
              <Statistic title={s.title} value={s.value} valueStyle={{ fontSize: 18, ...(s.valueStyle || {}) }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabs by status group */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
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
        size="small" pagination={{ pageSize: 20 }} scroll={{ x: 1000 }} />

      {/* Edit modal */}
      <Modal open={!!editOrder} title={`Pedido ${editOrder?.order_number}`}
        onCancel={() => setEditOrder(null)} footer={null} width={480}>
        <Form form={form} layout="vertical" onFinish={onSave}>
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
    </div>
  )
}
