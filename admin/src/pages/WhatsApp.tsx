import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Select, Space, Typography,
  Tag, Card, Row, Col, message, Divider, Tabs, Checkbox, Alert,
} from 'antd'
import {
  SendOutlined, WhatsAppOutlined, NotificationOutlined,
  WarningOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getMessages, sendMessage, getSellers, getBuyers } from '../api/client'
import api from '../api/client'
import type { WhatsAppMessage, Seller, Buyer } from '../types'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

const TEMPLATES = [
  { key: 'seller_received', label: 'Artículo recibido', audience: 'seller' },
  { key: 'seller_listed', label: 'Artículo publicado', audience: 'seller' },
  { key: 'seller_sold', label: 'Artículo vendido', audience: 'seller' },
  { key: 'buyer_confirmed', label: 'Pedido confirmado', audience: 'buyer' },
  { key: 'buyer_shipped', label: 'Pedido enviado', audience: 'buyer' },
  { key: 'buyer_delivered', label: 'Pedido entregado', audience: 'buyer' },
]

export default function WhatsAppHub() {
  const qc = useQueryClient()
  const [composeOpen, setComposeOpen] = useState(false)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [form] = Form.useForm()
  const [campaignForm] = Form.useForm()
  const [recipientType, setRecipientType] = useState<'seller' | 'buyer' | 'custom'>('seller')

  const { data: messages = [], isLoading } = useQuery<WhatsAppMessage[]>({
    queryKey: ['whatsapp-messages'],
    queryFn: () => getMessages().then(r => r.data),
    refetchInterval: 15_000,
  })
  const { data: sellers = [] } = useQuery<Seller[]>({ queryKey: ['sellers'], queryFn: () => getSellers().then(r => r.data) })
  const { data: buyers = [] } = useQuery<Buyer[]>({ queryKey: ['buyers'], queryFn: () => getBuyers().then(r => r.data) })

  const sendMutation = useMutation({
    mutationFn: (data: object) => sendMessage(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-messages'] }); setComposeOpen(false); form.resetFields(); message.success('Mensaje enviado') },
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
    onSuccess: (res) => { message.success(`Recordatorios enviados a ${res.data.sellers_notified} vendedoras`) },
    onError: () => message.error('Error al enviar recordatorios'),
  })

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
    campaignMutation.mutate({
      audience: values.audience,
      body: values.body,
      audience_ids: values.specific_ids?.length ? values.specific_ids : undefined,
    })
  }

  const outbound = messages.filter(m => m.direction === 'outbound').length
  const inbound = messages.filter(m => m.direction === 'inbound').length

  const columns: ColumnsType<WhatsAppMessage> = [
    {
      title: 'Dir.', dataIndex: 'direction', width: 90,
      render: v => <Tag color={v === 'outbound' ? 'blue' : 'green'}>{v === 'outbound' ? '→ Salida' : '← Entrada'}</Tag>,
    },
    {
      title: 'Tipo', dataIndex: 'message_type', width: 90,
      render: v => <Tag>{v}</Tag>,
    },
    { title: 'Número', dataIndex: 'to_number', width: 140, render: (v, r) => r.direction === 'inbound' ? (r as any).from_number : v },
    { title: 'Mensaje', dataIndex: 'body', ellipsis: true },
    { title: 'Estado', dataIndex: 'status', width: 90, render: v => v ? <Tag>{v}</Tag> : '—' },
    { title: 'Fecha', dataIndex: 'created_at', width: 130, render: v => dayjs(v).format('DD/MM HH:mm') },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#c41d7f', margin: 0 }}>
          <WhatsAppOutlined style={{ color: '#25d366', marginRight: 8 }} />WhatsApp Hub
        </Title>
        <Space>
          <Button
            icon={<WarningOutlined />}
            loading={stagnantMutation.isPending}
            onClick={() => stagnantMutation.mutate()}
            style={{ borderColor: '#faad14', color: '#faad14' }}
          >
            Recordar inventario detenido
          </Button>
          <Button
            icon={<NotificationOutlined />}
            onClick={() => setCampaignOpen(true)}
            style={{ borderColor: '#722ed1', color: '#722ed1' }}
          >
            Campaña masiva
          </Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => setComposeOpen(true)}
            style={{ background: '#25d366', borderColor: '#25d366' }}>
            Nuevo mensaje
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { label: 'Enviados', value: outbound, color: '#096dd9' },
          { label: 'Recibidos', value: inbound, color: '#389e0d' },
          { label: 'Total', value: messages.length, color: '#595959' },
        ].map(s => (
          <Col key={s.label}>
            <Card size="small" style={{ borderRadius: 8, borderColor: '#ffe0f0' }}>
              <Text type="secondary">{s.label}: </Text>
              <Text strong style={{ color: s.color }}>{s.value}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Table dataSource={messages} columns={columns} rowKey="id" loading={isLoading}
        size="small" pagination={{ pageSize: 30 }} />

      {/* Compose modal */}
      <Modal open={composeOpen} title="Nuevo mensaje WhatsApp"
        onCancel={() => setComposeOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={onSend}>
          <Form.Item label="Tipo de destinatario">
            <Select value={recipientType} onChange={v => { setRecipientType(v); form.resetFields(['recipient_id', 'custom_number']) }}>
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
          <Divider style={{ margin: '8px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>Plantillas rápidas:</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 12px' }}>
            {TEMPLATES.filter(t => t.audience === recipientType || recipientType === 'custom').map(t => (
              <Tag key={t.key} style={{ cursor: 'pointer', borderColor: '#c41d7f', color: '#c41d7f' }}
                onClick={() => form.setFieldValue('body', `[${t.label}] `)}>
                {t.label}
              </Tag>
            ))}
          </div>
          <Form.Item name="body" label="Mensaje" rules={[{ required: true }]}>
            <TextArea rows={5} placeholder="Escribe tu mensaje aquí..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setComposeOpen(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sendMutation.isPending}
              style={{ background: '#25d366', borderColor: '#25d366' }}>Enviar</Button>
          </div>
        </Form>
      </Modal>

      {/* Campaign modal */}
      <Modal open={campaignOpen} title={<span><NotificationOutlined style={{ color: '#722ed1', marginRight: 6 }} />Campaña masiva</span>}
        onCancel={() => setCampaignOpen(false)} footer={null} width={520}>
        <Alert
          message="Los mensajes se enviarán a todos los contactos del grupo seleccionado."
          type="info" showIcon style={{ marginBottom: 16 }}
        />
        <Form form={campaignForm} layout="vertical" onFinish={onCampaign}>
          <Form.Item name="audience" label="Audiencia" rules={[{ required: true }]}>
            <Select>
              <Option value="all_sellers"><TeamOutlined style={{ color: '#c41d7f', marginRight: 4 }} />Todas las vendedoras ({sellers.length})</Option>
              <Option value="all_buyers"><UserOutlined style={{ color: '#722ed1', marginRight: 4 }} />Todas las compradoras ({buyers.length})</Option>
            </Select>
          </Form.Item>
          <Form.Item name="body" label="Mensaje de la campaña" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="Hola {nombre}! 🌸 Escribe tu mensaje aquí..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setCampaignOpen(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<NotificationOutlined />}
              loading={campaignMutation.isPending}
              style={{ background: '#722ed1', borderColor: '#722ed1' }}>
              Enviar campaña
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
