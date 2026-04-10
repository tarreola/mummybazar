import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Row, Col, Card, Statistic, Typography, Spin, Tag, Table, Rate,
  Avatar, Segmented, DatePicker, Space, Tooltip,
} from 'antd'
import {
  RiseOutlined, FallOutlined, MinusOutlined, WarningOutlined, TrophyOutlined,
} from '@ant-design/icons'
import { Column, Pie } from '@ant-design/charts'
import dayjs, { Dayjs } from 'dayjs'
import {
  getDashboardSummary, getRevenueByMonth,
  getDashboardTopSellers, getDashboardTopBuyers, getDashboardByCategory,
} from '../api/client'
import type { DashboardPeriod } from '../api/client'
import api from '../api/client'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const CATEGORY_LABEL: Record<string, string> = {
  clothing: 'Ropa', furniture: 'Muebles', lactancy: 'Lactancia',
  strollers: 'Carriolas', toys: 'Juguetes', accessories: 'Accesorios', other: 'Otro',
}

const PERIOD_OPTIONS = [
  { label: 'Semana', value: 'WTD' },
  { label: 'Mes', value: 'MTD' },
  { label: 'Trimestre', value: 'QTD' },
  { label: 'Año', value: 'YTD' },
  { label: 'Rango', value: 'CUSTOM' },
]

const COMPARISON_LABEL: Record<string, string> = {
  WTD: 'vs sem. anterior',
  MTD: 'vs mes anterior',
  QTD: 'vs trimestre ant.',
  YTD: 'vs año anterior',
  CUSTOM: 'vs periodo igual ant.',
}

// ── Delta badge ────────────────────────────────────────────────────────────────
function Delta({ value }: { value: number | null | undefined }) {
  if (value == null) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
  const up = value >= 0
  const color = up ? '#389e0d' : '#f5222d'
  const Icon = up ? RiseOutlined : FallOutlined
  return (
    <span style={{ fontSize: 11, color, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Icon /> {up ? '+' : ''}{value}%
    </span>
  )
}

// ── KPI card with delta ────────────────────────────────────────────────────────
function KpiCard({ title, value, prefix, suffix, color, delta, compLabel }: {
  title: string
  value: number | string
  prefix?: string
  suffix?: string
  color: string
  delta?: number | null
  compLabel?: string
}) {
  return (
    <Card style={{ borderRadius: 12, borderColor: '#ffe0f0', height: '100%' }}>
      <Statistic
        title={<Text style={{ color: '#888', fontSize: 13 }}>{title}</Text>}
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ color, fontSize: 22, fontWeight: 700 }}
        formatter={(v) => typeof v === 'number' ? v.toLocaleString('es-MX') : v}
      />
      {compLabel && (
        <div style={{ marginTop: 4 }}>
          <Delta value={delta} />
          {delta != null && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>{compLabel}</Text>
          )}
        </div>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('MTD')
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null)

  const dateParams = useMemo(() => {
    if (period === 'CUSTOM' && customRange) {
      return {
        period: 'CUSTOM' as DashboardPeriod,
        date_from: customRange[0].startOf('day').toISOString(),
        date_to: customRange[1].endOf('day').toISOString(),
      }
    }
    return { period }
  }, [period, customRange])

  const isCustomReady = period !== 'CUSTOM' || !!customRange

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary', dateParams],
    queryFn: () => getDashboardSummary(dateParams).then(r => r.data),
    refetchInterval: 60_000,
    enabled: isCustomReady,
  })

  const { data: revenue = [] } = useQuery({
    queryKey: ['revenue-by-month'],
    queryFn: () => getRevenueByMonth(6).then(r => r.data),
  })

  const { data: topSellers = [] } = useQuery({
    queryKey: ['top-sellers', dateParams],
    queryFn: () => getDashboardTopSellers(dateParams.period, (dateParams as any).date_from, (dateParams as any).date_to).then(r => r.data),
    enabled: isCustomReady,
  })

  const { data: topBuyers = [] } = useQuery({
    queryKey: ['top-buyers', dateParams],
    queryFn: () => getDashboardTopBuyers(dateParams.period, (dateParams as any).date_from, (dateParams as any).date_to).then(r => r.data),
    enabled: isCustomReady,
  })

  const { data: byCategory = [] } = useQuery({
    queryKey: ['sales-by-category', dateParams],
    queryFn: () => getDashboardByCategory(dateParams.period, (dateParams as any).date_from, (dateParams as any).date_to).then(r => r.data),
    enabled: isCustomReady,
  })

  const { data: stagnant = [] } = useQuery({
    queryKey: ['stagnant-items'],
    queryFn: () => api.get('/dashboard/stagnant-items?days=30&limit=10').then(r => r.data),
  })

  const compLabel = COMPARISON_LABEL[period]

  if (!isCustomReady) {
    return (
      <div>
        <Title level={4} style={{ color: '#c41d7f', marginBottom: 16 }}>Dashboard</Title>
        <PeriodBar period={period} onPeriod={setPeriod} customRange={customRange} onCustomRange={setCustomRange} />
        <div style={{ marginTop: 60, textAlign: 'center' }}>
          <Text type="secondary">Selecciona un rango de fechas para ver el dashboard.</Text>
        </div>
      </div>
    )
  }

  if (isLoading || !summary) return (
    <div>
      <Title level={4} style={{ color: '#c41d7f', marginBottom: 16 }}>Dashboard</Title>
      <PeriodBar period={period} onPeriod={setPeriod} customRange={customRange} onCustomRange={setCustomRange} />
      <Spin size="large" style={{ display: 'block', marginTop: 80 }} />
    </div>
  )

  const s = summary

  // Period label for subtitle
  const periodSubtitle = s.period_label
    ? `${dayjs(s.period_label.cur_start).format('DD/MM/YY')} – ${dayjs(s.period_label.cur_end).format('DD/MM/YY')}`
    : ''

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={4} style={{ color: '#c41d7f', margin: 0 }}>Dashboard</Title>
          {periodSubtitle && <Text type="secondary" style={{ fontSize: 12 }}>{periodSubtitle}</Text>}
        </div>
        <PeriodBar period={period} onPeriod={setPeriod} customRange={customRange} onCustomRange={setCustomRange} />
      </div>

      {/* Row 1 — Revenue KPIs */}
      <Row gutter={[12, 12]}>
        {[
          {
            title: 'Ventas brutas', value: s.revenue.gross, prefix: '$', suffix: 'MXN',
            color: '#c41d7f', delta: s.revenue.delta_gross,
          },
          {
            title: 'Comisión (30%)', value: s.revenue.commission, prefix: '$', suffix: 'MXN',
            color: '#389e0d', delta: s.revenue.delta_commission,
          },
          {
            title: 'Unidades vendidas', value: s.revenue.units_sold,
            color: '#096dd9', delta: s.revenue.delta_units,
          },
          {
            title: 'Pedidos', value: s.revenue.orders,
            color: '#531dab', delta: s.revenue.delta_orders,
          },
        ].map(k => (
          <Col xs={12} lg={6} key={k.title}>
            <KpiCard {...k} compLabel={compLabel} />
          </Col>
        ))}
      </Row>

      {/* Row 2 — Community + Alerts (no delta — always current snapshot) */}
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
                <Tag color={STATUS_COLORS[status]} style={{ minWidth: 110 }}>{STATUS_LABELS[status]}</Tag>
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
              <Text type="secondary">Sin ventas en este periodo</Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<span><TrophyOutlined style={{ color: '#faad14', marginRight: 6 }} />Top Vendedoras</span>}
            style={{ borderRadius: 12, borderColor: '#ffe0f0' }}
          >
            {topSellers.length === 0 ? <Text type="secondary">Sin datos en este periodo</Text> : topSellers.map((s: any, i: number) => (
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
            {topBuyers.length === 0 ? <Text type="secondary">Sin datos en este periodo</Text> : topBuyers.map((b: any, i: number) => (
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

// ── Period selector bar (extracted so it renders even during loading) ──────────
function PeriodBar({ period, onPeriod, customRange, onCustomRange }: {
  period: DashboardPeriod
  onPeriod: (p: DashboardPeriod) => void
  customRange: [Dayjs, Dayjs] | null
  onCustomRange: (r: [Dayjs, Dayjs] | null) => void
}) {
  return (
    <Space size={8} wrap>
      <Segmented
        options={PERIOD_OPTIONS}
        value={period}
        onChange={v => onPeriod(v as DashboardPeriod)}
        style={{ background: '#fff0f6', borderRadius: 8 }}
      />
      {period === 'CUSTOM' && (
        <RangePicker
          value={customRange}
          onChange={v => onCustomRange(v as [Dayjs, Dayjs] | null)}
          format="DD/MM/YY"
          disabledDate={d => d.isAfter(dayjs())}
          allowClear
          style={{ borderColor: '#c41d7f' }}
        />
      )}
    </Space>
  )
}
