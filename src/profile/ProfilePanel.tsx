import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { loadProfile, saveDisplayName } from './profileApi'
import '../auth/auth.css'

export function ProfilePanel({ session }: { session: Session }) {
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  async function refresh() {
    setLoading(true)
    setErrorMessage(null)
    const result = await loadProfile(session.user.id)
    setLoading(false)

    if (result.error) {
      setErrorMessage(result.error)
      return
    }

    setDisplayName(result.displayName ?? '')
  }

  useEffect(() => {
    refresh()
    // Runs once per signed-in user; refresh is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id])

  async function handleSave() {
    setSaving(true)
    setErrorMessage(null)
    setJustSaved(false)

    const result = await saveDisplayName(session.user.id, displayName)

    setSaving(false)

    if (result.error) {
      setErrorMessage(result.error)
      return
    }

    setJustSaved(true)
  }

  async function handleSignOut() {
    // Sign-out is not treated as a destructive action per UI-SPEC — no
    // confirmation dialog. AuthContext's onAuthStateChange subscription
    // picks up the resulting event and re-renders the signed-out view.
    await supabase.auth.signOut()
  }

  return (
    <div className="auth-card">
      <h2 className="heading">Profile</h2>
      <p className="body">Signed in as {session.user.email}</p>
      <div className="auth-field">
        <label className="label" htmlFor="display-name">
          Display name
        </label>
        <input
          id="display-name"
          type="text"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value)
            setJustSaved(false)
          }}
          disabled={loading}
        />
      </div>
      {errorMessage && <p className="label auth-error">{errorMessage}</p>}
      {justSaved && !errorMessage && <p className="label auth-saved">Saved.</p>}
      <button
        type="button"
        className="auth-submit body"
        onClick={handleSave}
        disabled={saving || loading}
      >
        Save
      </button>
      <button
        type="button"
        className="auth-secondary body"
        onClick={refresh}
        disabled={loading}
      >
        Reload from server
      </button>
      <button type="button" className="auth-secondary body" onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  )
}
