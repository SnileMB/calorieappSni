import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { toUserMessage } from './authErrors'
import './auth.css'

export function SignIn({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)

    if (signInError) {
      setErrorMessage(toUserMessage(signInError))
    }
  }

  return (
    <div className="auth-card">
      <h1 className="display">BOBLUR</h1>
      <h2 className="heading">Log In</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label className="label" htmlFor="signin-email">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="signin-password">
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {errorMessage && <p className="label auth-error">{errorMessage}</p>}
        <button type="submit" className="auth-submit body" disabled={submitting}>
          Log In
        </button>
      </form>
      <p className="body auth-switch">
        Need an account?{' '}
        <button type="button" className="auth-link body" onClick={onSwitchToSignUp}>
          Sign up
        </button>
      </p>
    </div>
  )
}
