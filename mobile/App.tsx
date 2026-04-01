import React, { useEffect, useMemo, useState } from 'react'
import { SafeAreaView, View, Text, TextInput, Button, ScrollView } from 'react-native'
import { ApiError, apiClient } from './src/api/client'
import { getSession, loginWithPassword, type AuthSession } from './src/auth/session'
import { getQueuedActions, queueLocalAction, flushLocalQueue, type QueuedAction } from './src/sync/queue'

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState<AuthSession | null>(getSession())
  const [queuedCount, setQueuedCount] = useState(0)
  const [status, setStatus] = useState('Sign in to start syncing field work.')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    void getQueuedActions().then((queued) => {
      if (mounted) {
        setQueuedCount(queued.length)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  const queuedLabel = useMemo(() => `Queued actions: ${queuedCount}`, [queuedCount])

  const handleLogin = async () => {
    setBusy(true)
    try {
      const nextSession = await loginWithPassword({ email, password })
      setSession(nextSession)
      setStatus(`Signed in as ${nextSession.user.name}`)
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus(`Login failed (${error.status}): ${error.message}`)
      } else if (error instanceof Error) {
        setStatus(`Login failed: ${error.message}`)
      } else {
        setStatus('Login failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleQueueOfflineAction = async () => {
    const total = await queueLocalAction('Field update', {
      queuedBy: session?.user.id ?? 'anonymous',
      synced: false
    })
    setQueuedCount(total)
    setStatus('Saved action locally. Sync will run when online.')
  }

  const handleSyncNow = async () => {
    setBusy(true)
    try {
      const drained = await flushLocalQueue(async (action: QueuedAction) => {
        await apiClient.post('/sync/actions', {
          actionId: action.id,
          label: action.label,
          createdAt: action.createdAt,
          payload: action.payload ?? null
        }, session?.accessToken)
      })
      setQueuedCount((value) => Math.max(0, value - drained))
      setStatus(drained > 0 ? `Synced ${drained} queued action(s).` : 'No queued actions to sync.')
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Sync failed: ${error.message}`)
      } else {
        setStatus('Sync failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>AgriTrace Mobile</Text>
        <Text style={{ marginTop: 8, marginBottom: 12 }}>{status}</Text>

        <View style={{ marginVertical: 12, gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>Login</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            style={{ borderWidth: 1, padding: 10, borderRadius: 4 }}
          />
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            style={{ borderWidth: 1, padding: 10, borderRadius: 4 }}
          />
          <Button title={busy ? 'Working...' : 'Login'} onPress={handleLogin} disabled={busy} />
          {session && <Text>Role: {session.user.role}</Text>}
        </View>

        <View style={{ marginVertical: 12, gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>Offline Queue</Text>
          <Text>{queuedLabel}</Text>
          <Button title="Queue Offline Action" onPress={handleQueueOfflineAction} />
          <Button title={busy ? 'Syncing...' : 'Sync Queue Now'} onPress={handleSyncNow} disabled={busy} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
