import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Space, Typography, Tag, Tooltip,
  message, Drawer, Descriptions, Rate, Statistic, Row, Col, Card, Badge, Popconfirm, Divider, List,
} from 'antd'
import { PlusOutlined, EditOutlined, WhatsAppOutlined, BarChartOutlined, CheckCircleOutlined, SearchOutlined, DollarOutlined, OrderedListOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { getSellers, createSeller, updateSeller, approveSeller, getOrders } from '../api/client'
import api from '../api/client'
import type { Seller, Order } from '../types'

const { Title, Text } = Typography

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pago pendiente', paid: 'Compra realizada', preparing: 'Preparando',
  shipped: 'Enviado', delivered: 'Confirmado', closed: 'Cerrado',
  cancelled: 'Cancelado', refunded: 'Reembolsado',
}
const ORDER_STATUS_COLOR: Record<string, string> = {
  pending_payment: 'orange', paid: 'blue', preparing: 'cyan', shipped: 'purple',
  delivered: 'green', closed: 'default', cancelled: 'red', refunded: 'default',
}

export default function Sellers() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [editSeller, setEditSeller] = useState<Seller | null>(null)
  const [statsSeller, setStatsSeller] = useState<Seller | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()

  const { data: sellers = [], isLoading } = useQuery<Seller[]>({
    queryKey: ['sellers'],
    queryFn: () => getSellers().then(r => r.data),
  })

  const { data: sellerOrders = [] } = useQuery<Order[]>({
    queryKey: ['orders', 'seller', statsSeller?.id],
    queryFn: () => getOrders({ seller_id: statsSeller!.id }).then(r => r.data),
    enabled: !!statsSeller,
  })

  const filteredSellers = useMemo(() => {
    if (!search.trim()) return sellers
    const q = search.toLowerCase()
    return sellers.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  }, [sellers, search])

  const createMutation = useMutation({
    mutationFn: (data: object) => createSeller(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sellers'] }); setModalOpen(false); form.resetFields() },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => updateSeller(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sellers'] }); setModalOpen(false) },
    onError: () => message.error('Error al actualizar'),
  })

  const openCreate = () => { setEditSeller(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (s: Seller) => { setEditSeller(s); form.setFieldsValue(s); setModalOpen(true) }

  const openStats = async (s: Seller) => {
    setStatsSeller(s)
    const res = await api.get(`/dashboard/seller-stats/${s.id}`)
    setStats(res.data)
  }

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveSeller(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sellers'] }); message.success('Vendedora aprobada') },
    onError: () => message.error('Error al aprobar'),
  })

  const onSave = (values: object) => {
    if (editSeller) updateMutation.mutate({ id: editSeller.id, data: values })
    else createMutation.mutate(values)
  }

  const columns: ColumnsType<Seller> = [
    {
      title: 'Nombre', dataIndex: 'full_name',
      render: (v, r) => (
        <Space size={4}>
          <a onClick={() => openStats(r)}>{v}</a>
          {(r as any).has_pending_payout && (
            <Tooltip title="Tiene pagos pendientes">
              <DollarOutlined style={{ color: '#f5222d' }} />
            </Tooltip>
          )}
        </Space>
      ),
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
    {
      title: 'Publicados', width: 90,
      render: (_, r) => {
        const count = (r as any).total_listed ?? '—'
        return <Tag color={count > 0 ? 'green' : 'default'}>{count}</Tag>
      },
    },
    {
      title: 'Aprobada', dataIndex: 'is_approved', width: 100,
      render: (v, r) => v
        ? <Tag color="green" icon={<CheckCircleOutlined />}>Sí</Tag>
        : (
          <Popconfirm
            title="¿Aprobar a esta vendedora?"
            onConfirm={() => approveMutation.mutate(r.id)}
            okText="Aprobar" cancelText="No"
          >
            <Tag color="orange" style={{ cursor: 'pointer' }}>Pendiente ✓</Tag>
          </Popconfirm>
        ),
    },
    {
      title: 'Calificación', dataIndex: 'rating', width: 150,
      render: (v, r) => (
        <Rate
          value={v || 0} count={5}
          style={{ fontSize: 14 }}
          onChange={rating => updateMutation.mutate({ id: r.id, data: { rating } })}
        />
      ),
    },
    {
      title: '', width: 80,
      render: (_, r) => (
        <Space>
          <Tooltip title="Ver perfil"><Button size="small" icon={<BarChartOutlined />} onClick={() => openStats(r)} /></Tooltip>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ color: '#1a3a6b', margin: 0 }}>Vendedoras</Title>
        <Space>
          <Input
            placeholder="Buscar vendedora…"
            prefix={<SearchOutlined style={{ color: '#1a3a6b' }} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#1a3a6b', borderColor: '#1a3a6b' }}>
            Nueva vendedora
          </Button>
        </Space>
      </div>

      <Table dataSource={filteredSellers} columns={columns} rowKey="id" loading={isLoading}
        size="small" pagination={{ pageSize: 20 }} />

      {/* Seller stats drawer */}
      <Drawer
        title={statsSeller ? `Perfil: ${statsSeller.full_name}` : ''}
        open={!!statsSeller} onClose={() => { setStatsSeller(null); setStats(null) }} width={440}
      >
        {statsSeller && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="WhatsApp">
                <a href={`https://wa.me/${statsSeller.phone.replace('+', '')}`} target="_blank" rel="noreferrer">
                  <WhatsAppOutlined style={{ color: '#25d366', marginRight: 4 }} />{statsSeller.phone}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Email">{statsSeller.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Colonia">{statsSeller.neighborhood || '—'}, {statsSeller.city}</Descriptions.Item>
              <Descriptions.Item label="Banco">{statsSeller.bank_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="CLABE">{statsSeller.clabe || '—'}</Descriptions.Item>
              <Descriptions.Item label="PayPal">{statsSeller.paypal_email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Calificación interna">
                <Rate value={statsSeller.rating || 0} count={5} style={{ fontSize: 14 }} disabled />
              </Descriptions.Item>
              <Descriptions.Item label="Notas">{statsSeller.notes || '—'}</Descriptions.Item>
            </Descriptions>

            {stats && (
              <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
                <Col xs={12}>
                  <Card size="small" style={{ borderRadius: 8, borderColor: '#c8d8f0', cursor: 'pointer' }}
                    onClick={() => { setStatsSeller(null); setStats(null); navigate(`/inventory?seller_id=${statsSeller!.id}`) }}>
                    <Statistic title={<span>Artículos totales <OrderedListOutlined style={{ color: '#1a3a6b', marginLeft: 4 }} /></span>}
                      value={stats.total_items} valueStyle={{ fontSize: 18 }} />
                  </Card>
                </Col>
                {[
                  { title: 'Publicados', value: stats.listed, valueStyle: { color: '#52c41a' } },
                  { title: 'Vendidos', value: stats.sold, valueStyle: { color: '#faad14' } },
                  { title: 'Total ganado', value: `$${stats.total_earned.toLocaleString('es-MX')}`, valueStyle: { color: '#389e0d' } },
                  { title: 'Pago pendiente', value: `$${stats.pending_payout.toLocaleString('es-MX')}`, valueStyle: { color: '#d46b08' } },
                ].map(s => (
                  <Col xs={12} key={s.title}>
                    <Card size="small" style={{ borderRadius: 8, borderColor: '#c8d8f0' }}>
                      <Statistic title={s.title} value={s.value} valueStyle={{ fontSize: 18, ...(s.valueStyle || {}) }} />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            {/* ── Pedidos activos y pagos pendientes ── */}
            {sellerOrders.length > 0 && (() => {
              const activeOrders = sellerOrders.filter(o =>
                ['pending_payment', 'paid', 'preparing', 'shipped'].includes(o.status)
              )
              const pendingPayout = sellerOrders.filter(o =>
                o.status === 'shipped' && !o.seller_paid
              )
              const pendingPayoutTotal = pendingPayout.reduce((s, o) => s + Number(o.seller_payout_amount), 0)

              return (
                <>
                  {pendingPayout.length > 0 && (
                    <>
                      <Divider style={{ margin: '12px 0 8px' }}>
                        <Tag color="orange" icon={<DollarOutlined />}>
                          Pagos pendientes — ${pendingPayoutTotal.toLocaleString('es-MX')} MXN
                        </Tag>
                      </Divider>
                      <List
                        size="small"
                        dataSource={pendingPayout}
                        renderItem={(o) => (
                          <List.Item
                            style={{ padding: '6px 0' }}
                            extra={
                              <Button size="small" type="link"
                                onClick={() => { setStatsSeller(null); setStats(null); navigate('/orders') }}>
                                Ver orden
                              </Button>
                            }
                          >
                            <div>
                              <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1a3a6b' }}>
                                {o.order_number}
                              </Text>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {o.item_title} · <strong>${Number(o.seller_payout_amount).toLocaleString('es-MX')}</strong>
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />
                    </>
                  )}

                  {activeOrders.length > 0 && (
                    <>
                      <Divider style={{ margin: '12px 0 8px' }}>
                        <Tag color="blue" icon={<ClockCircleOutlined />}>
                          Pedidos en curso ({activeOrders.length})
                        </Tag>
                      </Divider>
                      <List
                        size="small"
                        dataSource={activeOrders}
                        renderItem={(o) => (
                          <List.Item style={{ padding: '6px 0' }}>
                            <div style={{ flex: 1 }}>
                              <Space size={6}>
                                <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#1a3a6b' }}>{o.order_number}</Text>
                                <Tag color={ORDER_STATUS_COLOR[o.status]} style={{ fontSize: 10, margin: 0 }}>
                                  {ORDER_STATUS_LABEL[o.status]}
                                </Tag>
                              </Space>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {o.item_title} · {dayjs(o.created_at).format('DD/MM/YY')}
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />
                    </>
                  )}

                  <div style={{ marginTop: 10, textAlign: 'right' }}>
                    <Button size="small" icon={<OrderedListOutlined />}
                      onClick={() => { setStatsSeller(null); setStats(null); navigate('/orders') }}>
                      Ver todos los pedidos
                    </Button>
                  </div>
                </>
              )
            })()}
          </>
        )}
      </Drawer>

      {/* Add/Edit modal */}
      <Modal open={modalOpen} title={editSeller ? 'Editar vendedora' : 'Nueva vendedora'}
        onCancel={() => setModalOpen(false)} footer={null} width={520}>
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="full_name" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="WhatsApp (con código de país)" rules={[{ required: true, message: 'Requerido' }]} extra="Ej: +525512345678">
            <Input disabled={!!editSeller} />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Requerido' }, { type: 'email', message: 'Email inválido' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="neighborhood" label="Colonia" rules={[{ required: true, message: 'Requerido' }]}>
            <Input />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="bank_name" label="Banco (opcional)"><Input placeholder="BBVA, Santander…" /></Form.Item>
            <Form.Item name="clabe" label="CLABE interbancaria (opcional)"><Input /></Form.Item>
          </Space>
          <Form.Item name="notes" label="Notas del admin (opcional)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="rating" label="Calificación interna (opcional)">
            <Rate count={5} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ background: '#1a3a6b', borderColor: '#1a3a6b' }}>
              {editSeller ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
