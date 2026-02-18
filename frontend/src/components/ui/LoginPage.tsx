import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { login } from '../../api/auth'

export function LoginPage() {
  const setToken = useAuthStore((s) => s.setToken)
  const [email, setEmail] = useState('demo@adhd.local')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const token = await login(email, password)
      setToken(token.access_token)
    } catch {
      setError('Nieprawidłowy email lub hasło')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ADHD Calendar</h1>
        <p className="text-sm text-gray-500 mb-6">Zaloguj się, aby kontynuować</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-4 text-center">
          Demo: demo@adhd.local / demo1234
        </p>
      </div>
    </div>
  )
}
