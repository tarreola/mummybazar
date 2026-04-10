import { Layout, Menu, Avatar, Dropdown, Typography, Button } from 'antd'
import {
  DashboardOutlined, ShoppingOutlined, TeamOutlined,
  OrderedListOutlined, WhatsAppOutlined, LogoutOutlined, UserOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../store/auth'

const { Sider, Header, Content } = Layout
const { Text } = Typography

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
          borderRight: '1px solid #ffe0f0',
          position: 'fixed',
          height: '100vh',
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #ffe0f0' }}>
          <div style={{ fontSize: 28 }}>🌸</div>
          <Text strong style={{ color: '#c41d7f', fontSize: 16, display: 'block', lineHeight: 1.2 }}>
            MommyBazar
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Admin Panel</Text>
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
            style={{ borderColor: '#ffadd2', color: '#c41d7f' }}
          >
            Salir
          </Button>
        </div>
      </Sider>

      <Layout style={{ marginLeft: 220 }}>
        <Header style={{
          background: '#fff',
          borderBottom: '1px solid #ffe0f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: 56,
        }}>
          <Avatar style={{ background: '#ffadd2', color: '#c41d7f' }} icon={<UserOutlined />} />
        </Header>

        <Content style={{ padding: 24, background: '#fff8fc', minHeight: 'calc(100vh - 56px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
