import { Layout, Menu, Avatar, Typography, Button } from 'antd'
import {
  DashboardOutlined, ShoppingOutlined, TeamOutlined,
  OrderedListOutlined, WhatsAppOutlined, LogoutOutlined, UserOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../store/auth'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const NAVY = '#1a3a6b'
const RED  = '#d42b2b'
const BORDER = '#c8d8f0'
const BG_LIGHT = '#eef2f9'

const NAV_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/inventory', icon: <ShoppingOutlined />, label: 'Inventario' },
  { key: '/sellers', icon: <TeamOutlined />, label: 'Vendedoras' },
  { key: '/orders', icon: <OrderedListOutlined />, label: 'Pedidos' },
  { key: '/whatsapp', icon: <WhatsAppOutlined />, label: 'WhatsApp Hub' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{
          background: '#fff',
          borderRight: `1px solid ${BORDER}`,
          position: 'fixed',
          height: '100vh',
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
          <img src="/logo.png" alt="El Ropero de Mar" style={{ width: 160, height: 'auto', objectFit: 'contain' }} />
          <div><Text type="secondary" style={{ fontSize: 11 }}>Admin Panel</Text></div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={NAV_ITEMS}
          style={{ border: 'none', marginTop: 8 }}
        />

        {/* Logout at bottom */}
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, padding: '0 16px' }}>
          <Button
            block
            icon={<LogoutOutlined />}
            onClick={signOut}
            style={{ borderColor: BORDER, color: NAVY }}
          >
            Salir
          </Button>
        </div>
      </Sider>

      <Layout style={{ marginLeft: 220 }}>
        <Header style={{
          background: '#fff',
          borderBottom: `1px solid ${BORDER}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: 56,
        }}>
          <Avatar style={{ background: BG_LIGHT, color: NAVY }} icon={<UserOutlined />} />
        </Header>

        <Content style={{ padding: 24, background: '#f5f8ff', minHeight: 'calc(100vh - 56px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
