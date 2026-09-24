import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { toUserMessage } from './authErrors'
import './auth.css'

export function SignUp({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    const { error: signUpError } = await supabase.auth.signUp({ email, password })

    setSubmitting(false)

    if (signUpError) {
      setErrorMessage(toUserMessage(signUpError))
    }
  }

  return (
    <div className="auth-card">
      <h1 className="display">BOBLUR</h1>
      <h2 className="heading">Sign Up</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label className="label" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        {errorMessage && <p className="label auth-error">{errorMessage}</p>}
        <button type="submit" className="auth-submit body" disabled={submitting}>
          Create Account
        </button>
      </form>
      <p className="body auth-switch">
        Already have an account?{' '}
        <button type="button" className="auth-link body" onClick={onSwitchToSignIn}>
          Log in
        </button>
      </p>
    </div>
  )
}
