import { useAuthStore } from './store/authStore'
import { LoginPage } from './components/ui/LoginPage'
import { AppLayout } from './components/ui/AppLayout'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <AppLayout />
}
