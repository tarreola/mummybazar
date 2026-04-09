import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Space, Typography, Tag, Tooltip,
  message, Drawer, Descriptions, Rate, Statistic, Row, Col, Card, List,
} from 'antd'
import { PlusOutlined, EditOutlined, WhatsAppOutlined, BarChartOutlined, BellOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getBuyers, createBuyer, updateBuyer, getOrders } from '../api/client'
import api from '../api/client'
import type { Buyer, Order } from '../types'

const { Title, Text } = Typography

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pago pendiente', paid: 'Pagado', preparing: 'Preparando',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado',
}
const ORDER_STATUS_COLOR: Record<string, string> = {
  pending_payment: 'orange', paid: 'blue', preparing: 'cyan',
  shipped: 'purple', delivered: 'green', cancelled: 'red', refunded: 'default',
}

export default function Buyers() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editBuyer, setEditBuyer] = useState<Buyer | null>(null)
  const [profileBuyer, setProfileBuyer] = useState<Buyer | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([])
  const [form] = Form.useForm()

  const { data: buyers = [], isLoading } = useQuery<Buyer[]>({
    queryKey: ['buyers'],
    queryFn: () => getBuyers().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => createBuyer(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['buyers'] }); setModalOpen(false); form.resetFields() },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => updateBuyer(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['buyers'] }); setModalOpen(false) },
    onError: () => message.error('Error al actualizar'),
  })

  const remindMutation = useMutation({
    mutationFn: (orderId: number) => api.post(`/whatsapp/remind-payment/${orderId}`),
    onSuccess: () => message.success('Recordatorio enviado por WhatsApp'),
    onError: () => message.error('Error al enviar recordatorio (revisa credenciales de Twilio)'),
  })

  const openCreate = () => { setEditBuyer(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (b: Buyer) => { setEditBuyer(b); form.setFieldsValue(b); setModalOpen(true) }

  const openProfile = async (b: Buyer) => {
    setProfileBuyer(b)
    const [statsRes, ordersRes] = await Promise.all([
      api.get(`/dashboard/buyer-stats/${b.id}`),
      getOrders({ buyer_id: b.id }),
    ])
    setStats(statsRes.data)
    setBuyerOrders(ordersRes.data)
  }

  const onSave = (values: object) => {
    if (editBuyer) updateMutation.mutate({ id: editBuyer.id, data: values })
    else createMutation.mutate(values)
  }

  const columns: ColumnsType<Buyer> = [
    {
      title: 'Nombre', dataIndex: 'full_name',
      render: (v, r) => <a onClick={() => openProfile(r)}>{v}</a>,
    },
    {
      title: 'WhatsApp', dataIndex: 'phone',
      render: v => (
        <a href={`https://wa.me/${v.replace('+', '')}`} target="_blank" rel="noreferrer">
          <Space size={4}><WhatsAppOutlined style={{ color: '#25d366' }} />{v}</Space>
        </a>
      ),
    },
    { title: 'Email', dataIndex: 'email', render: v => v || '—' },
    { title: 'Colonia', dataIndex: 'neighborhood', render: v => v || '—' },
    {
      title: 'Calificación', dataIndex: 'rating', width: 140,
      render: (v, r) => (
        <Rate value={v || 0} count={5} style={{ fontSize: 14 }}
          onChange={rating => updateMutation.mutate({ id: r.id, data: { rating } })} />
      ),
    },
    {
      title: 'Estado', dataIndex: 'is_active', width: 80,
      render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag>,
    },
    {
      title: '', width: 80,
      render: (_, r) => (
        <Space>
          <Tooltip title="Ver perfil"><Button size="small" icon={<BarChartOutlined />} onClick={() => openProfile(r)} /></Tooltip>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
        </Space>
      ),
    },
  ]

  const pendingOrders = buyerOrders.filter(o => o.status === 'pending_payment')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#c41d7f', margin: 0 }}>Compradoras</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#c41d7f', borderColor: '#c41d7f' }}>
          Nueva compradora
        </Button>
      </div>

      <Table dataSource={buyers} columns={columns} rowKey="id" loading={isLoading}
        size="small" pagination={{ pageSize: 20 }} />

      {/* Buyer profile drawer */}
      <Drawer
        title={profileBuyer ? `Perfil: ${profileBuyer.full_name}` : ''}
        open={!!profileBuyer} onClose={() => { setProfileBuyer(null); setStats(null); setBuyerOrders([]) }}
        width={480}
      >
        {profileBuyer && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="WhatsApp">
                <a href={`https://wa.me/${profileBuyer.phone.replace('+', '')}`} target="_blank" rel="noreferrer">
                  <WhatsAppOutlined style={{ color: '#25d366', marginRight: 4 }} />{profileBuyer.phone}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Email">{profileBuyer.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Colonia">{profileBuyer.neighborhood || '—'}, {profileBuyer.city}</Descriptions.Item>
              <Descriptions.Item label="Calificación interna">
                <Rate value={profileBuyer.rating || 0} count={5} style={{ fontSize: 14 }} disabled />
              </Descriptions.Item>
              <Descriptions.Item label="Notas">{profileBuyer.notes || '—'}</Descriptions.Item>
            </Descriptions>

            {stats && (
              <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
                {[
                  { title: 'Total pedidos', value: stats.total_orders },
                  { title: 'Pagados', value: stats.paid_orders, valueStyle: { color: '#52c41a' } },
                  { title: 'Total gastado', value: `$${stats.total_spent.toLocaleString('es-MX')}`, valueStyle: { color: '#096dd9' } },
                  { title: 'Pendiente de pago', value: `$${stats.pending_amount.toLocaleString('es-MX')}`, valueStyle: { color: stats.pending_amount > 0 ? '#f5222d' : undefined } },
                ].map(s => (
                  <Col xs={12} key={s.title}>
                    <Card size="small" style={{ borderRadius: 8, borderColor: '#ffe0f0' }}>
                      <Statistic title={s.title} value={s.value} valueStyle={{ fontSize: 16, ...(s.valueStyle || {}) }} />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            {/* Pending orders with reminder button */}
            {pendingOrders.length > 0 && (
              <Card
                size="small"
                title={<Text style={{ color: '#f5222d' }}>Pagos pendientes ({pendingOrders.length})</Text>}
                style={{ borderColor: '#ffccc7', marginBottom: 16 }}
              >
                <List
                  dataSource={pendingOrders}
                  renderItem={order => (
                    <List.Item
                      actions={[
                        <Tooltip title="Enviar recordatorio por WhatsApp">
                          <Button
                            size="small" icon={<BellOutlined />}
                            loading={remindMutation.isPending}
                            onClick={() => remindMutation.mutate(order.id)}
                            style={{ borderColor: '#25d366', color: '#25d366' }}
                          >
                            Recordar
                          </Button>
                        </Tooltip>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<Text style={{ fontSize: 12 }}>{order.order_number}</Text>}
                        description={<Text type="secondary" style={{ fontSize: 11 }}>${Number(order.amount).toLocaleString('es-MX')} MXN</Text>}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {/* Order history */}
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Historial de pedidos</Text>
            <Table
              dataSource={buyerOrders} rowKey="id" size="small" pagination={false}
              columns={[
                { title: 'Pedido', dataIndex: 'order_number', render: v => <code style={{ fontSize: 11 }}>{v}</code> },
                { title: 'Monto', dataIndex: 'amount', render: v => `$${Number(v).toLocaleString('es-MX')}` },
                {
                  title: 'Estado', dataIndex: 'status',
                  render: v => <Tag color={ORDER_STATUS_COLOR[v]} style={{ fontSize: 10 }}>{ORDER_STATUS_LABEL[v]}</Tag>,
                },
                { title: 'Fecha', dataIndex: 'created_at', render: v => dayjs(v).format('DD/MM/YY') },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* Add/Edit modal */}
      <Modal open={modalOpen} title={editBuyer ? 'Editar compradora' : 'Nueva compradora'}
        onCancel={() => setModalOpen(false)} footer={null} width={480}>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="full_name" label="Nombre completo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="WhatsApp (con código de país)" rules={[{ required: true }]} extra="Ej: +525512345678">
            <Input disabled={!!editBuyer} />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="email" label="Email"><Input /></Form.Item>
            <Form.Item name="neighborhood" label="Colonia"><Input /></Form.Item>
          </Space>
          <Form.Item name="rating" label="Calificación interna">
            <Rate count={5} />
          </Form.Item>
          <Form.Item name="notes" label="Notas del admin">
            <Input.TextArea rows={3} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ background: '#c41d7f', borderColor: '#c41d7f' }}>
              {editBuyer ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
