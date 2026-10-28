import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { supabase } from '../lib/supabase'

// Supabase's message for bad email or password is deliberately vague; map the common cases to plain text.
function friendly(message: string, status?: number) {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Wrong email or password.'
  if (m.includes('email not confirmed')) return 'This email is not confirmed yet. Confirm it in the Supabase dashboard.'
  if (m.includes('rate limit') || status === 429) return 'Too many attempts. Wait a minute and try again.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Cannot reach the server. Check your connection.'
  return message
}

export default function Login() {
  const session = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    // on success onAuthStateChange updates the session and the route guard lets us in
    if (error) setError(friendly(error.message, error.status))
  }

  // already signed in (fresh login or saved session): leave the login page
  if (session) return <Navigate to="/" replace />

  const field = 'w-full min-h-[44px] border rounded-lg px-3'
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">OrderDesk</h1>
        <input
          type="email" name="username" autoComplete="username" required autoFocus
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" className={field}
        />
        <input
          type="password" name="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" className={field}
        />
        <button disabled={busy} className="w-full min-h-[44px] rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      </form>
    </div>
  )
}
