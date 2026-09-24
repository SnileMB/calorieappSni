import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { SignIn } from './auth/SignIn'
import { SignUp } from './auth/SignUp'
import { ProfilePanel } from './profile/ProfilePanel'
import './auth/auth.css'

function App() {
  const { session, loading } = useAuth()
  const [showSignUp, setShowSignUp] = useState(true)

  if (loading) {
    // Minimal neutral placeholder — never flash the auth form for a user
    // who turns out to already have a persisted session.
    return <main className="auth-page auth-loading" />
  }

  if (!session) {
    return (
      <main className="auth-page">
        {showSignUp ? (
          <SignUp onSwitchToSignIn={() => setShowSignUp(false)} />
        ) : (
          <SignIn onSwitchToSignUp={() => setShowSignUp(true)} />
        )}
      </main>
    )
  }

  return (
    <main className="auth-page">
      <ProfilePanel session={session} />
    </main>
  )
}

export default App
