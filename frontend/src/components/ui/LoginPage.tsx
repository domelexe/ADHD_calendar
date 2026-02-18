import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { login, register } from '../../api/auth'

type Mode = 'login' | 'register'

export function LoginPage() {
  const setTokens = useAuthStore((s) => s.setTokens)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      if (mode === 'login') {
        const token = await login(email, password)
        setTokens(token.access_token, token.refresh_token)
      } else {
        await register(email, password, inviteToken)
        setSuccess('Konto utworzone! Możesz się teraz zalogować.')
        setMode('login')
        setInviteToken('')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (mode === 'login') {
        setError(msg ?? 'Nieprawidłowy email lub hasło')
      } else {
        setError(msg ?? 'Błąd rejestracji. Sprawdź kod zaproszenia.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">ADHD Calendar</h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'login' ? 'Zaloguj się, aby kontynuować' : 'Utwórz nowe konto'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
              autoComplete="email"
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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kod zaproszenia</label>
              <input
                type="text"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value.trim())}
                placeholder="Wklej kod otrzymany od administratora"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                required
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? (mode === 'login' ? 'Logowanie...' : 'Tworzenie konta...')
              : (mode === 'login' ? 'Zaloguj się' : 'Utwórz konto')}
          </button>
        </form>

        <div className="mt-4 text-center">
          {mode === 'login' ? (
            <button
              onClick={() => { setMode('register'); setError(''); setSuccess('') }}
              className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Masz kod zaproszenia? Zarejestruj się
            </button>
          ) : (
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess('') }}
              className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Masz już konto? Zaloguj się
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
