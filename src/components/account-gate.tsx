import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { Button } from '@ui-sdk/react/button'
import { Github } from './github-icon'
import { supabase } from '../cloud'

export function AccountGate({
  children,
}: {
  children: (user: User | null, signOut?: () => Promise<void>) => ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    let active = true
    let receivedEvent = false
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
      setError('')
      setBusy(false)
    })
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || receivedEvent) return
        setUser(data.session?.user ?? null)
        setLoading(false)
        if (error)
          setError('Could not restore your session. Please sign in again.')
      })
      .catch(() => {
        if (!active || receivedEvent) return
        setLoading(false)
        setError('Could not restore your session. Please sign in again.')
      })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (!supabase) return children(null)

  async function signIn() {
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase!.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/` },
      })
      if (error) throw error
    } catch {
      setError('Could not start GitHub sign-in. Please try again.')
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase!.auth.signOut({ scope: 'local' })
      if (error) throw error
    } catch {
      setError('Could not sign out. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {user && !loading ? (
        children(user, signOut)
      ) : (
        <main className="account-page">
          <div className="account-card">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true" />
              kekkai.
            </div>
            <h1>A little space for your day.</h1>
            <p>
              Tasks, deadlines, and discoveries. Kept together, wherever you
              sign in.
            </p>
            {loading ? (
              <p role="status">Restoring your session…</p>
            ) : (
              <Button
                className="button primary account-sign-in"
                disabled={busy}
                onClick={signIn}
              >
                <Github size={18} />
                {busy ? 'Connecting…' : 'Continue with GitHub'}
              </Button>
            )}
            <span className="account-note">
              Your workspace is private to your account.
            </span>
          </div>
        </main>
      )}
      {error && (
        <div className="account-error" role="alert">
          {error}
        </div>
      )}
    </>
  )
}
