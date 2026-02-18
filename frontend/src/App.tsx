import { useAuthStore } from './store/authStore'
import { LoginPage } from './components/ui/LoginPage'
import { AppLayout } from './components/ui/AppLayout'

export default function App() {
  const token = useAuthStore((s) => s.token)

  if (!token) {
    return <LoginPage />
  }

  return <AppLayout />
}
