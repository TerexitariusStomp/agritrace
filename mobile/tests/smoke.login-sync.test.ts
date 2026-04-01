import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../src/api/client'
import { clearSession, getSession, loginWithPassword } from '../src/auth/session'
import { clearLocalQueue, flushLocalQueue, getQueuedActions, queueLocalAction } from '../src/sync/queue'

describe('mobile login and offline sync contracts', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    clearSession()
    await clearLocalQueue()
  })

  it('sends credentials to /auth/login and stores session', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.agritrace.test/auth/login')
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
      expect(init?.body).toBe(JSON.stringify({ email: 'alice@example.com', password: 'Password123!' }))

      return new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            name: 'Alice Farmer',
            email: 'alice@example.com',
            role: 'farmer',
            locale: 'en'
          },
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    })

    vi.stubGlobal('fetch', fetchMock)

    const session = await loginWithPassword(
      {
        email: 'Alice@Example.com ',
        password: 'Password123!'
      },
      createApiClient('https://api.agritrace.test')
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(session.user.role).toBe('farmer')
    expect(getSession()?.accessToken).toBe('access-token')
  })

  it('queues local actions deterministically for offline sync flow', async () => {
    const firstCount = await queueLocalAction('Field update', { farmId: 'farm-1' })
    const secondCount = await queueLocalAction('Photo upload', { farmId: 'farm-1' })
    const queued = await getQueuedActions()

    expect(firstCount).toBe(1)
    expect(secondCount).toBe(2)
    expect(queued).toHaveLength(2)
    expect(queued.map((action) => action.label)).toEqual(['Field update', 'Photo upload'])
  })

  it('flushes queued actions via sender and clears queue', async () => {
    await queueLocalAction('Field update', { farmId: 'farm-1' })
    await queueLocalAction('Photo upload', { farmId: 'farm-1' })

    const sender = vi.fn(async () => Promise.resolve())
    const drained = await flushLocalQueue(sender)
    const queued = await getQueuedActions()

    expect(drained).toBe(2)
    expect(sender).toHaveBeenCalledTimes(2)
    expect(queued).toEqual([])
  })
})
