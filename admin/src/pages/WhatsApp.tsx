import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Select, Space, Typography,
  Tag, Card, Row, Col, message, Divider, Alert, Tabs,
  Collapse, Tooltip, Badge,
} from 'antd'
import {
  SendOutlined, WhatsAppOutlined, NotificationOutlined,
  WarningOutlined, TeamOutlined, UserOutlined, MessageOutlined,
  EyeOutlined, ShoppingOutlined, CopyOutlined, SearchOutlined, PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getMessages, sendMessage, getSellers, getBuyers, createBuyer } from '../api/client'
import api from '../api/client'
import type { WhatsAppMessage, Seller, Buyer } from '../types'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input

// ── Status labels map (from backend) ─────────────────────────────────────────
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: '💳 Pago pendiente',
  paid:            '✅ Pagado',
  preparing:       '📦 En preparación',
  shipped:         '🚚 Enviado',
  delivered:       '🎀 Entregado',
  cancelled:       '❌ Cancelado',
  refunded:        '🔄 Reembolsado',
}

// ── Template groups definition (mirrors backend) ──────────────────────────────
interface TemplateGroup {
  key: string
  label: string
  audience: 'seller' | 'buyer' | 'any'
  variables: string[]     // variable names needed for preview
  description: string
}

const TEMPLATE_GROUPS: TemplateGroup[] = [
  // Seller
  { key: 'seller_welcome',       label: '👋 Bienvenida a vendedora',    audience: 'seller', variables: ['name'],                               description: 'Primera vez que se registra una vendedora' },
  { key: 'seller_item_received', label: '📥 Artículo recibido',          audience: 'seller', variables: ['name', 'item_title', 'sku'],           description: 'Cuando el bazar recibe un artículo' },
  { key: 'seller_item_listed',   label: '🟢 Artículo publicado',         audience: 'seller', variables: ['name', 'item_title', 'selling_price'], description: 'Cuando el artículo queda publicado' },
  { key: 'seller_item_sold',     label: '🥳 Artículo vendido',           audience: 'seller', variables: ['name', 'item_title', 'seller_payout'], description: 'Cuando alguien compra el artículo' },
  { key: 'seller_payout_sent',   label: '💸 Pago realizado',             audience: 'seller', variables: ['name', 'item_title', 'amount'],        description: 'Cuando se transfiere el pago a la vendedora' },
  // Buyer
  { key: 'buyer_welcome',           label: '👋 Bienvenida a compradora',  audience: 'buyer', variables: ['name'],                                                description: 'Primera vez que se registra una compradora' },
  { key: 'buyer_order_confirmed',   label: '✅ Pedido confirmado',         audience: 'buyer', variables: ['name', 'item_title', 'order_number', 'amount'],        description: 'Auto: al crear una orden' },
  { key: 'buyer_order_shipped',     label: '🚚 Pedido enviado',            audience: 'buyer', variables: ['name', 'item_title', 'order_number', 'tracking_number', 'carrier'], description: 'Auto: al marcar como enviado' },
  { key: 'buyer_order_delivered',   label: '🎀 Pedido entregado',          audience: 'buyer', variables: ['name', 'item_title'],                                 description: 'Auto: al marcar como entregado' },
  { key: 'buyer_delivery_confirm',  label: '❓ Confirmar recepción',        audience: 'buyer', variables: ['name', 'order_number', 'item_title'],                 description: 'Pregunta al cliente si recibió su pedido' },
]

const SAMPLE_VARS: Record<string, string> = {
  name: 'María',
  item_title: 'Conjunto floral 3-6m Zara',
  sku: 'MB-2024-00123',
  selling_price: '350',
  seller_payout: '245',
  amount: '350',
  order_number: 'ORD-2024-00001',
  tracking_number: '1234567890',
  carrier: 'Estafeta',
  promo_items: '• Conjunto floral 3-6m — $350 MXN\n• Carriola Graco — $1,200 MXN\n',
  body: 'Tenemos una promoción especial solo para ti.',
  count: '2',
  days: '30',
  titles: '*Conjunto floral 3-6m* y *Carriola Graco*',
}

// ── Template card (with preview) ──────────────────────────────────────────────
function TemplateCard({ tpl, onUse }: { tpl: TemplateGroup; onUse: (key: string) => void }) {
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)

  const loadPreview = async () => {
    if (preview) return
    setLoading(true)
    try {
      const vars = Object.fromEntries(tpl.variables.map(v => [v, SAMPLE_VARS[v] || `{${v}}`]))
      const res = await api.post('/whatsapp/template-preview', { template_key: tpl.key, variables: vars })
      setPreview(res.data.rendered)
    } catch { setPreview('Error al cargar preview') }
    setLoading(false)
  }

  const copy = () => { navigator.clipboard.writeText(preview); message.success('Copiado') }

  return (
    <Card
      size="small"
      style={{ borderRadius: 10, borderColor: '#ffe0f0', marginBottom: 8 }}
      extra={
        <Space size={4}>
          <Tooltip title="Ver preview"><Button size="small" icon={<EyeOutlined />} onClick={loadPreview} loading={loading} /></Tooltip>
          {preview && <Tooltip title="Copiar"><Button size="small" icon={<CopyOutlined />} onClick={copy} /></Tooltip>}
          <Button size="small" type="primary" icon={<SendOutlined />}
            style={{ background: '#25d366', borderColor: '#25d366' }}
            onClick={() => onUse(tpl.key)}>
            Usar
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 13 }}>{tpl.label}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{tpl.description}</Text>
        </div>
        <Tag color={tpl.audience === 'seller' ? 'pink' : 'purple'} style={{ fontSize: 10 }}>
          {tpl.audience === 'seller' ? 'Vendedora' : 'Compradora'}
        </Tag>
      </div>
      {preview && (
        <div style={{
          marginTop: 8, background: '#f6ffed', border: '1px solid #b7eb8f',
          borderRadius: 8, padding: '8px 12px',
          fontSize: 12, color: '#262626', whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
        }}>
          {preview}
        </div>
      )}
    </Card>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WhatsAppHub() {
  const qc = useQueryClient()
  const [composeOpen, setComposeOpen] = useState(false)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [recipientType, setRecipientType] = useState<'seller' | 'buyer' | 'custom'>('buyer')
  const [promoItems, setPromoItems] = useState<any[]>([])
  const [form] = Form.useForm()
  const [campaignForm] = Form.useForm()
  const [addContactForm] = Form.useForm()
  const [campaignType, setCampaignType] = useState<'promo' | 'general' | 'stagnant'>('general')
  const [contactSearch, setContactSearch] = useState('')

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery<WhatsAppMessage[]>({
    queryKey: ['whatsapp-messages'],
    queryFn: () => getMessages().then(r => r.data),
    refetchInterval: 15_000,
  })
  const { data: sellers = [] } = useQuery<Seller[]>({
    queryKey: ['sellers'],
    queryFn: () => getSellers().then(r => r.data),
  })
  const { data: buyers = [] } = useQuery<Buyer[]>({
    queryKey: ['buyers'],
    queryFn: () => getBuyers().then(r => r.data),
  })
  const { data: listedItems = [] } = useQuery({
    queryKey: ['items', 'listed'],
    queryFn: () => api.get('/items/?status=listed').then(r => r.data),
    enabled: campaignOpen && campaignType === 'promo',
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (data: object) => sendMessage(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      setComposeOpen(false)
      form.resetFields()
      message.success('Mensaje enviado')
    },
    onError: () => message.error('Error al enviar (revisa credenciales de Twilio)'),
  })

  const campaignMutation = useMutation({
    mutationFn: (data: object) => api.post('/whatsapp/campaign', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      setCampaignOpen(false)
      campaignForm.resetFields()
      message.success(`Campaña enviada: ${res.data.sent} enviados, ${res.data.failed} fallidos`)
    },
    onError: () => message.error('Error en campaña'),
  })

  const stagnantMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/remind-stagnant?days=30'),
    onSuccess: (res) => message.success(`Recordatorios enviados a ${res.data.sellers_notified} vendedoras`),
    onError: () => message.error('Error al enviar recordatorios'),
  })

  const addContactMutation = useMutation({
    mutationFn: (data: object) => createBuyer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buyers'] })
      setAddContactOpen(false)
      addContactForm.resetFields()
      message.success('Contacto agregado')
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Error al agregar contacto'),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const useTemplate = (key: string) => {
    setSelectedTemplate(key)
    const tpl = TEMPLATE_GROUPS.find(t => t.key === key)
    if (tpl) setRecipientType(tpl.audience === 'seller' ? 'seller' : 'buyer')
    setComposeOpen(true)
  }

  const onSend = (values: any) => {
    let to_number = values.custom_number || ''
    let seller_id: number | undefined
    let buyer_id: number | undefined

    if (recipientType === 'seller' && values.recipient_id) {
      const s = sellers.find(s => s.id === values.recipient_id)
      to_number = s?.phone || ''
      seller_id = values.recipient_id
    } else if (recipientType === 'buyer' && values.recipient_id) {
      const b = buyers.find(b => b.id === values.recipient_id)
      to_number = b?.phone || ''
      buyer_id = values.recipient_id
    }
    if (!to_number) return message.error('Número de destino requerido')
    sendMutation.mutate({ to_number, body: values.body, seller_id, buyer_id })
  }

  const onCampaign = (values: any) => {
    if (campaignType === 'stagnant') {
      stagnantMutation.mutate()
      setCampaignOpen(false)
      campaignForm.resetFields()
      return
    }
    campaignMutation.mutate({
      audience: values.audience,
      body: values.body || '',
      template_key: campaignType === 'promo' ? 'campaign_promo' : 'campaign_general',
      promo_item_ids: campaignType === 'promo' ? values.promo_items : undefined,
      audience_ids: undefined,
    })
  }

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return buyers
    const q = contactSearch.toLowerCase()
    return buyers.filter(b =>
      b.full_name?.toLowerCase().includes(q) ||
      b.phone?.includes(q) ||
      b.email?.toLowerCase().includes(q)
    )
  }, [buyers, contactSearch])

  // Stats
  const outbound = messages.filter(m => m.direction === 'outbound').length
  const inbound = messages.filter(m => m.direction === 'inbound').length
  const today = messages.filter(m => dayjs(m.created_at).isAfter(dayjs().startOf('day'))).length

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns: ColumnsType<WhatsAppMessage> = [
    {
      title: 'Dir.', dataIndex: 'direction', width: 90,
      render: v => <Tag color={v === 'outbound' ? 'blue' : 'green'}>{v === 'outbound' ? '↗ Salida' : '↙ Entrada'}</Tag>,
    },
    {
      title: 'Tipo', dataIndex: 'message_type', width: 95,
      render: v => <Tag color={v === 'marketing' ? 'purple' : v === 'template' ? 'cyan' : 'default'}>{v}</Tag>,
    },
    {
      title: 'Número', width: 145,
      render: (_, r: any) => {
        const num = r.direction === 'inbound' ? r.from_number : r.to_number
        return (
          <a href={`https://wa.me/${num?.replace('+', '')}`} target="_blank" rel="noreferrer">
            <WhatsAppOutlined style={{ color: '#25d366', marginRight: 4 }} />{num}
          </a>
        )
      },
    },
    {
      title: 'Mensaje', dataIndex: 'body', ellipsis: true,
      render: v => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 85,
      render: v => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : '—',
    },
    {
      title: 'Fecha', dataIndex: 'created_at', width: 115,
      render: v => <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format('DD/MM HH:mm')}</Text>,
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#c41d7f', margin: 0 }}>
          <WhatsAppOutlined style={{ color: '#25d366', marginRight: 8 }} />WhatsApp Hub
        </Title>
        <Space wrap>
          <Button icon={<NotificationOutlined />} onClick={() => setCampaignOpen(true)}
            style={{ borderColor: '#722ed1', color: '#722ed1' }}>
            Campaña masiva
          </Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => { setSelectedTemplate(null); setComposeOpen(true) }}
            style={{ background: '#25d366', borderColor: '#25d366' }}>
            Nuevo mensaje
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Enviados hoy', value: today, color: '#25d366' },
          { label: 'Total enviados', value: outbound, color: '#096dd9' },
          { label: 'Recibidos', value: inbound, color: '#389e0d' },
          { label: 'Total mensajes', value: messages.length, color: '#595959' },
        ].map(s => (
          <Col key={s.label}>
            <Card size="small" style={{ borderRadius: 8, borderColor: '#ffe0f0', minWidth: 130 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
              <div><Text strong style={{ color: s.color, fontSize: 22 }}>{s.value}</Text></div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Labels info card */}
      <Card
        size="small"
        title={<span><Tag color="green" style={{ marginRight: 4 }}>Labels WhatsApp</Tag> por estado de orden</span>}
        style={{ borderRadius: 10, borderColor: '#ffe0f0', marginBottom: 16 }}
      >
        <Row gutter={[8, 4]}>
          {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
            <Col key={status} xs={12} sm={8} md={6}>
              <Tag style={{ fontSize: 12, marginBottom: 4 }}>{label}</Tag>
            </Col>
          ))}
        </Row>
        <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
          Los labels se aplican automáticamente en WhatsApp Business al cambiar el estado de cada orden.
        </Text>
      </Card>

      <Tabs
        defaultActiveKey="contacts"
        items={[
          {
            key: 'contacts',
            label: <span><UserOutlined />Contactos <Badge count={buyers.length} color="#c41d7f" /></span>,
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Input
                    placeholder="Buscar por nombre, teléfono o email…"
                    prefix={<SearchOutlined style={{ color: '#c41d7f' }} />}
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    allowClear
                    style={{ width: 300 }}
                  />
                  <Button type="primary" icon={<PlusOutlined />}
                    onClick={() => setAddContactOpen(true)}
                    style={{ background: '#c41d7f', borderColor: '#c41d7f' }}>
                    Añadir contacto
                  </Button>
                </div>
                <Table
                  dataSource={filteredContacts}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 30 }}
                  columns={[
                    {
                      title: 'Nombre', dataIndex: 'full_name',
                      render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
                    },
                    {
                      title: 'Teléfono', dataIndex: 'phone', width: 155,
                      render: (v: string) => v ? (
                        <a href={`https://wa.me/${v.replace('+', '')}`} target="_blank" rel="noreferrer">
                          <WhatsAppOutlined style={{ color: '#25d366', marginRight: 4 }} />
                          <Text style={{ fontSize: 12 }}>{v}</Text>
                        </a>
                      ) : '—',
                    },
                    {
                      title: 'Email', dataIndex: 'email', width: 200,
                      render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : '—',
                    },
                    {
                      title: 'Órdenes', dataIndex: 'total_orders', width: 85, align: 'center' as const,
                      render: (v: number) => v > 0 ? <Tag color="blue">{v}</Tag> : <Tag>0</Tag>,
                    },
                    {
                      title: '', width: 80,
                      render: (_: any, r: any) => (
                        <Tooltip title="Enviar WhatsApp">
                          <Button size="small" icon={<SendOutlined />}
                            style={{ borderColor: '#25d366', color: '#25d366' }}
                            onClick={() => {
                              setRecipientType('buyer')
                              form.setFieldsValue({ recipient_id: r.id })
                              setComposeOpen(true)
                            }}
                          />
                        </Tooltip>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'templates',
            label: <span><EyeOutlined />Templates</span>,
            children: (
              <div>
                <Alert
                  message="Estos mensajes se envían automáticamente al cambiar estados de órdenes. También puedes enviarlos manualmente desde aquí."
                  type="info" showIcon style={{ marginBottom: 16 }}
                />
                <Collapse
                  defaultActiveKey={['seller', 'buyer', 'campaign']}
                  items={[
                    {
                      key: 'seller',
                      label: <span><TeamOutlined style={{ color: '#c41d7f', marginRight: 6 }} />Para Vendedoras</span>,
                      children: TEMPLATE_GROUPS.filter(t => t.audience === 'seller').map(t => (
                        <TemplateCard key={t.key} tpl={t} onUse={useTemplate} />
                      )),
                    },
                    {
                      key: 'buyer',
                      label: <span><UserOutlined style={{ color: '#722ed1', marginRight: 6 }} />Para Compradoras</span>,
                      children: TEMPLATE_GROUPS.filter(t => t.audience === 'buyer').map(t => (
                        <TemplateCard key={t.key} tpl={t} onUse={useTemplate} />
                      )),
                    },
                    {
                      key: 'campaign',
                      label: <span><NotificationOutlined style={{ color: '#fa8c16', marginRight: 6 }} />Campaña / Recordatorio</span>,
                      children: (
                        <div>
                          <Alert
                            message='Usa el botón "Campaña masiva" de la barra superior para enviar a múltiples contactos.'
                            type="warning" showIcon style={{ marginBottom: 8 }}
                          />
                          {TEMPLATE_GROUPS.filter(t => t.audience === 'any').map(t => (
                            <TemplateCard key={t.key} tpl={t} onUse={useTemplate} />
                          ))}
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'log',
            label: <span><MessageOutlined />Historial ({messages.length})</span>,
            children: (
              <Table dataSource={messages} columns={columns} rowKey="id" loading={isLoading}
                size="small" pagination={{ pageSize: 30 }} />
            ),
          },
        ]}
      />

      {/* ── Compose modal ─────────────────────────────────────────────────────── */}
      <Modal open={composeOpen} title="Nuevo mensaje WhatsApp"
        onCancel={() => setComposeOpen(false)} footer={null} width={520}>
        <Form form={form} layout="vertical" onFinish={onSend}>
          <Form.Item label="Destinatario">
            <Select value={recipientType}
              onChange={v => { setRecipientType(v); form.resetFields(['recipient_id', 'custom_number']) }}>
              <Option value="seller">Vendedora registrada</Option>
              <Option value="buyer">Compradora registrada</Option>
              <Option value="custom">Número personalizado</Option>
            </Select>
          </Form.Item>

          {recipientType === 'seller' && (
            <Form.Item name="recipient_id" label="Vendedora" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label"
                options={sellers.map(s => ({ value: s.id, label: `${s.full_name} (${s.phone})` }))} />
            </Form.Item>
          )}
          {recipientType === 'buyer' && (
            <Form.Item name="recipient_id" label="Compradora" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label"
                options={buyers.map(b => ({ value: b.id, label: `${b.full_name} (${b.phone})` }))} />
            </Form.Item>
          )}
          {recipientType === 'custom' && (
            <Form.Item name="custom_number" label="Número (con código de país)" rules={[{ required: true }]} extra="Ej: +525512345678">
              <Input />
            </Form.Item>
          )}

          <Divider style={{ margin: '8px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Plantillas rápidas</Text>
          </Divider>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {TEMPLATE_GROUPS
              .filter(t => t.audience === recipientType || recipientType === 'custom')
              .map(t => (
                <Tag key={t.key}
                  style={{ cursor: 'pointer', borderColor: '#c41d7f', color: '#c41d7f', fontSize: 11 }}
                  onClick={() => {
                    // Fill body with template text using sample vars
                    const vars = Object.fromEntries(t.variables.map(v => [v, SAMPLE_VARS[v] || `{${v}}`]))
                    api.post('/whatsapp/template-preview', { template_key: t.key, variables: vars })
                      .then(r => form.setFieldValue('body', r.data.rendered))
                      .catch(() => form.setFieldValue('body', `[${t.label}]`))
                  }}>
                  {t.label}
                </Tag>
              ))}
          </div>

          <Form.Item name="body" label="Mensaje" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="Escribe tu mensaje aquí, o selecciona una plantilla arriba…" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setComposeOpen(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sendMutation.isPending}
              style={{ background: '#25d366', borderColor: '#25d366' }}>Enviar</Button>
          </div>
        </Form>
      </Modal>

      {/* ── Add contact modal ────────────────────────────────────────────────── */}
      <Modal open={addContactOpen} title="Añadir contacto"
        onCancel={() => { setAddContactOpen(false); addContactForm.resetFields() }} footer={null} width={440}>
        <Form form={addContactForm} layout="vertical" onFinish={v => addContactMutation.mutate(v)}>
          <Form.Item name="full_name" label="Nombre completo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="WhatsApp (con código de país)" rules={[{ required: true }]} extra="Ej: +525512345678">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="neighborhood" label="Colonia">
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setAddContactOpen(false); addContactForm.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={addContactMutation.isPending}
              style={{ background: '#c41d7f', borderColor: '#c41d7f' }}>
              Guardar
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Campaign modal ────────────────────────────────────────────────────── */}
      <Modal open={campaignOpen}
        title={<span><NotificationOutlined style={{ color: '#722ed1', marginRight: 6 }} />Campaña masiva</span>}
        onCancel={() => { setCampaignOpen(false); campaignForm.resetFields() }}
        footer={null} width={560}>

        <Alert
          message="El mensaje se personalizará con el nombre de cada destinataria automáticamente."
          type="info" showIcon style={{ marginBottom: 16 }}
        />

        <Form form={campaignForm} layout="vertical" onFinish={onCampaign}>
          <Form.Item label="Tipo de campaña">
            <Select value={campaignType} onChange={v => { setCampaignType(v as any); campaignForm.resetFields(['audience', 'body', 'promo_items']) }}>
              <Option value="general">
                <MessageOutlined style={{ marginRight: 6 }} />Mensaje general personalizado
              </Option>
              <Option value="promo">
                <ShoppingOutlined style={{ color: '#c41d7f', marginRight: 6 }} />Promoción con artículos del inventario
              </Option>
              <Option value="stagnant">
                <WarningOutlined style={{ color: '#faad14', marginRight: 6 }} />Recordar artículos sin movimiento (+30 días)
              </Option>
            </Select>
          </Form.Item>

          {campaignType !== 'stagnant' && (
            <Form.Item name="audience" label="Audiencia" rules={[{ required: true }]}>
              <Select>
                <Option value="all_sellers">
                  <TeamOutlined style={{ color: '#c41d7f', marginRight: 6 }} />
                  Todas las vendedoras ({sellers.length})
                </Option>
                <Option value="all_buyers">
                  <UserOutlined style={{ color: '#722ed1', marginRight: 6 }} />
                  Todas las compradoras ({buyers.length})
                </Option>
              </Select>
            </Form.Item>
          )}

          {campaignType === 'stagnant' && (
            <Alert
              message="Se enviará un recordatorio automático a todas las vendedoras con artículos sin movimiento hace más de 30 días."
              type="warning" showIcon style={{ marginBottom: 12 }}
            />
          )}

          {campaignType === 'promo' && (
            <Form.Item name="promo_items" label="Artículos en promoción" rules={[{ required: true, message: 'Selecciona al menos un artículo' }]}>
              <Select
                mode="multiple" showSearch optionFilterProp="label"
                placeholder="Busca y selecciona artículos publicados…"
                options={(listedItems as any[]).map((i: any) => ({
                  value: i.id,
                  label: `${i.sku} — ${i.title} ($${Number(i.selling_price).toLocaleString('es-MX')})`,
                }))}
              />
            </Form.Item>
          )}

          {campaignType === 'general' && (
            <Form.Item name="body" label="Mensaje" rules={[{ required: true }]}
              extra='Usa {nombre} para personalizar con el nombre de cada destinataria.'>
              <TextArea rows={6} placeholder={'Hola {nombre}! 🌸 Tenemos novedades para ti en MommyBazar...'} />
            </Form.Item>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setCampaignOpen(false); campaignForm.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit"
              icon={campaignType === 'stagnant' ? <WarningOutlined /> : <NotificationOutlined />}
              loading={campaignMutation.isPending || stagnantMutation.isPending}
              style={{ background: '#722ed1', borderColor: '#722ed1' }}>
              {campaignType === 'stagnant' ? 'Enviar recordatorios' : 'Enviar campaña'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
