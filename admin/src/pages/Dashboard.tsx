import { useQuery } from '@tanstack/react-query'
import { Row, Col, Card, Statistic, Typography, Spin, Tag, Table, Rate, Avatar } from 'antd'
import {
  ShoppingOutlined, DollarOutlined, TeamOutlined, UserOutlined,
  ClockCircleOutlined, WarningOutlined, RiseOutlined, TrophyOutlined,
} from '@ant-design/icons'
import { Column, Pie } from '@ant-design/charts'
import dayjs from 'dayjs'
import {
  getDashboardSummary, getRevenueByMonth, getItems, getSellers, getBuyers,
} from '../api/client'
import api from '../api/client'

const { Title, Text } = Typography

const CATEGORY_LABEL: Record<string, string> = {
  clothing: 'Ropa', furniture: 'Muebles', lactancy: 'Lactancia',
  strollers: 'Carriolas', toys: 'Juguetes', accessories: 'Accesorios', other: 'Otro',
}

function KpiCard({ title, value, prefix, suffix, color, icon }: {
  title: string; value: number | string; prefix?: string; suffix?: string;
  color: string; icon?: React.ReactNode
}) {
  return (
    <Card style={{ borderRadius: 12, borderColor: '#ffe0f0', height: '100%' }}>
      <Statistic
        title={<Text style={{ color: '#888', fontSize: 13 }}>{title}</Text>}
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ color, fontSize: 24, fontWeight: 700 }}
        formatter={(v) => typeof v === 'number' ? v.toLocaleString('es-MX') : v}
      />
    </Card>
  )
}

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => getDashboardSummary().then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: revenue = [] } = useQuery({
    queryKey: ['revenue-by-month'],
    queryFn: () => getRevenueByMonth(6).then(r => r.data),
  })

  const { data: topSellers = [] } = useQuery({
    queryKey: ['top-sellers'],
    queryFn: () => api.get('/dashboard/top-sellers?limit=5').then(r => r.data),
  })

  const { data: topBuyers = [] } = useQuery({
    queryKey: ['top-buyers'],
    queryFn: () => api.get('/dashboard/top-buyers?limit=5').then(r => r.data),
  })

  const { data: byCategory = [] } = useQuery({
    queryKey: ['sales-by-category'],
    queryFn: () => api.get('/dashboard/sales-by-category').then(r => r.data),
  })

  const { data: stagnant = [] } = useQuery({
    queryKey: ['stagnant-items'],
    queryFn: () => api.get('/dashboard/stagnant-items?days=30&limit=10').then(r => r.data),
  })

  if (isLoading) return <Spin size="large" style={{ display: 'block', marginTop: 80 }} />

  const s = summary!

  // Charts data
  const revenueChartData = revenue.flatMap((r: any) => [
    { month: r.month, type: 'Venta bruta', value: r.gross },
    { month: r.month, type: 'Comisión (30%)', value: r.commission },
  ])

  const categoryPieData = byCategory.map((c: any) => ({
    type: CATEGORY_LABEL[c.category] || c.category,
    value: c.units,
  }))

  const STATUS_COLORS: Record<string, string> = {
    received: '#1677ff', inspected: '#13c2c2', listed: '#52c41a',
    sold: '#faad14', shipped: '#fa8c16', delivered: '#722ed1',
    returned: '#f5222d', archived: '#d9d9d9',
  }
  const STATUS_LABELS: Record<string, string> = {
    received: 'Recibido', inspected: 'Inspeccionado', listed: 'Publicado',
    sold: 'Vendido', shipped: 'Enviado', delivered: 'Entregado',
    returned: 'Devuelto', archived: 'Archivado',
  }

  return (
    <div>
      <Title level={4} style={{ color: '#c41d7f', marginBottom: 20 }}>Dashboard</Title>

      {/* Row 1 — Revenue KPIs */}
      <Row gutter={[12, 12]}>
        {[
          { title: 'Ventas este mes', value: s.revenue.month_gross, prefix: '$', suffix: 'MXN', color: '#c41d7f' },
          { title: 'Comisión este mes', value: s.revenue.month_commission, prefix: '$', suffix: 'MXN', color: '#389e0d' },
          { title: 'Unidades vendidas (mes)', value: s.revenue.units_sold_month, color: '#096dd9' },
          { title: 'Pedidos totales', value: s.totals.orders, color: '#531dab' },
        ].map(k => (
          <Col xs={12} lg={6} key={k.title}>
            <KpiCard {...k} />
          </Col>
        ))}
      </Row>

      {/* Row 2 — Community + Alerts */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        {[
          { title: 'Vendedoras', value: s.totals.sellers, color: '#c41d7f' },
          { title: 'Compradoras', value: s.totals.buyers, color: '#722ed1' },
          { title: 'Pagos pendientes a vendedoras', value: s.pending_seller_payouts, prefix: '$', suffix: 'MXN', color: '#d46b08' },
          { title: 'Artículos sin movimiento (+30 días)', value: s.stagnant_items_count, color: '#f5222d' },
        ].map(k => (
          <Col xs={12} lg={6} key={k.title}>
            <KpiCard {...k} />
          </Col>
        ))}
      </Row>

      {/* Row 3 — Revenue chart + Inventory status */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={15}>
          <Card title="Ingresos últimos 6 meses" style={{ borderRadius: 12, borderColor: '#ffe0f0' }}>
            <Column
              data={revenueChartData}
              xField="month" yField="value" seriesField="type" isGroup
              colorField="type"
              scale={{ color: { range: ['#ff85c2', '#ffadd2'] } }}
              height={240} label={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title="Estado del inventario" style={{ borderRadius: 12, borderColor: '#ffe0f0', height: '100%' }}>
            {Object.entries(s.inventory as Record<string, number>).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Tag color={STATUS_COLORS[status]} style={{ minWidth: 100 }}>{STATUS_LABELS[status]}</Tag>
                <Text strong style={{ fontSize: 16 }}>{count}</Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Row 4 — Category pie + Top sellers + Top buyers */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={8}>
          <Card title="Ventas por categoría" style={{ borderRadius: 12, borderColor: '#ffe0f0' }}>
            {categoryPieData.length > 0 ? (
              <Pie
                data={categoryPieData} angleField="value" colorField="type"
                height={220} label={{ text: 'type', style: { fontSize: 11 } }}
                legend={{ position: 'bottom' }}
              />
            ) : (
              <Text type="secondary">Sin ventas registradas aún</Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<span><TrophyOutlined style={{ color: '#faad14', marginRight: 6 }} />Top Vendedoras</span>}
            style={{ borderRadius: 12, borderColor: '#ffe0f0' }}
          >
            {topSellers.length === 0 ? <Text type="secondary">Sin datos aún</Text> : topSellers.map((s: any, i: number) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar size="small" style={{ background: '#ffadd2', color: '#c41d7f', fontSize: 11 }}>{i + 1}</Avatar>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{s.full_name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{s.sales} ventas</Text>
                  </div>
                </div>
                <Text style={{ color: '#389e0d', fontWeight: 600 }}>${s.revenue.toLocaleString('es-MX')}</Text>
              </div>
            ))}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<span><TrophyOutlined style={{ color: '#c41d7f', marginRight: 6 }} />Top Compradoras</span>}
            style={{ borderRadius: 12, borderColor: '#ffe0f0' }}
          >
            {topBuyers.length === 0 ? <Text type="secondary">Sin datos aún</Text> : topBuyers.map((b: any, i: number) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar size="small" style={{ background: '#d9f7be', color: '#389e0d', fontSize: 11 }}>{i + 1}</Avatar>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{b.full_name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{b.purchases} compras</Text>
                  </div>
                </div>
                <Text style={{ color: '#096dd9', fontWeight: 600 }}>${b.spent.toLocaleString('es-MX')}</Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Row 5 — Stagnant items */}
      {stagnant.length > 0 && (
        <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
          <Col xs={24}>
            <Card
              title={<span><WarningOutlined style={{ color: '#f5222d', marginRight: 6 }} />Artículos sin movimiento (+30 días publicados)</span>}
              style={{ borderRadius: 12, borderColor: '#ffccc7' }}
            >
              <Table
                dataSource={stagnant}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'SKU', dataIndex: 'sku', width: 130, render: v => <code style={{ color: '#c41d7f' }}>{v}</code> },
                  { title: 'Artículo', dataIndex: 'title' },
                  { title: 'Categoría', dataIndex: 'category', width: 110, render: v => CATEGORY_LABEL[v] || v },
                  { title: 'Precio', dataIndex: 'selling_price', width: 110, render: v => `$${Number(v).toLocaleString('es-MX')}` },
                  {
                    title: 'Días publicado', dataIndex: 'days_listed', width: 120,
                    render: v => <Tag color="red">{v} días</Tag>,
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}
