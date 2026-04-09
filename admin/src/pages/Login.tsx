import { useState } from 'react'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

const { Title, Text } = Typography

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      await signIn(values.email, values.password)
      navigate('/')
    } catch {
      message.error('Correo o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #ff85c2 0%, #ffadd2 50%, #fff0f6 100%)',
    }}>
      <Card style={{ width: 380, borderRadius: 16, boxShadow: '0 8px 32px rgba(255,133,194,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🌸</div>
          <Title level={3} style={{ margin: 0, color: '#c41d7f' }}>MommyBazar Admin</Title>
          <Text type="secondary">Panel de administración</Text>
        </div>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Ingresa tu correo' }]}>
            <Input prefix={<UserOutlined />} placeholder="correo@ejemplo.com" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" size="large" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
            style={{ background: '#c41d7f', borderColor: '#c41d7f', borderRadius: 8 }}
          >
            Entrar
          </Button>
        </Form>
      </Card>
    </div>
  )
}
