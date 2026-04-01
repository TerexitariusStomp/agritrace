import { createSign } from 'node:crypto'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'batch-123' })
}))

import { TracePage } from '../src/pages/TracePage'

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDYic3BFKRiGxtN
JljjwccKoJ8754E+TlT34CHTrSsFH8Ep+Yg5KT/shQfgAOImnbp01zqd12pFBxv6
73VSxAHKCJ8KZH/lXF25KyyaF/EvcIZ0/gf3t/HPbK0F/Tq9qTtrYKgVA36GdLUo
mJAisgqQ4Z2Xlu6BjRMr7ye9SY8zBxjbblXYTHviVk6dCzxzc47RNpY/3IDLAebP
utR6l5wP21oWvJhRPAhakJC6TfYfs/t8VCjBp6NSJX5nbVhalrfZzp925Mglr4xv
ete2hApVfcJ98GAy1F6W0rCRhbPp3nBoNbAmDRvWHsZ3Jmg7vGpnYHHdTMHpA4wb
Y2ExJlJbAgMBAAECggEASclLb4vVKAkMmJGEoLebV6e8GvGcPNr8YSri2/qaOjjD
3cXGAZRoz/PU5yPl7Dq7Gq1sr/SDpdnyUuPeGsHnyix95VCxtDpxRXPM0wVtjjjN
2HfnxyXLJF9n5i6QIajVMpXRMLfsGW0Tfi3ej7QTnaMDzHAF/edQrRvlcr7qKPyV
jnUjuYfh8cYxOGLjyskCRXdDZDIKMKD3YnAbSyStmGoXWekSvQ1ncrWe0To5U2G9
aeMCZ9Y9DSin0gJj2v3BU7N9etBYRrvX7DUl6r5ZRXeNfB4jTgQPmCvwAjYt+Dhn
CA7L8RIzD2KLvcjZQUE2+MlsgBZi6FUn7sa3Oa6UAQKBgQD0QsKKGLSvRzInr3w3
emGxV7MCizCf6VCZtJjHiQzS4zUDuZ8Fiu88cDbX9btA/YMjASPgn0ulxAx+9eo2
AClJ6xbGa9EzV+xpW1oFWaOAdgBKbnKZPru2D+eD3tqN7d9gCZ6Px11R509TKud2
QUWZmE6SLVEaf5fK0Ha6H2Tb2wKBgQDi8fZ3WO535UjkaS2roZJ42AAa7xKEXVLA
S/kJppJvVbzyIMR4+wekzRVtrE39YVd9shID3yF4ofp+eQ1/pjRuDajukWgCCY3H
aruwwOFo3FEYRr/EVo0P1Q7wMUpw+SBQ+MZPR41OM7Ww1FUOwBB31IWX3RHbyomx
v8ZL0P1rgQKBgD82B6I1Qo0Zn6EliL/Sq/V4/Jpr6ul3N6SPV/pLPUZWBiIwpzaH
/eFmKMs6jHsFICqu4NoAX1NGqPUyLqpK4GSAsiQnQrxGxKd/PIyl5eoYn3qjmoSN
94XmF8PIqEaSiHwSATa0ITJQ6fZb5Ap2Wcyl3a92isaQvnd9+zuvZCqBAoGAc440
qwxzUEVFWlhb0tqQVEvXsd8tlIxYSGXmxo00XtBPRxJ8OAXKHJX4ZUGo7G2WOQBk
v+friRshCyjkQK0GYUs/S0pqpS7sLDAipZtwqw4TlMLhfj170iXwV0kh2Ghhlhk2
EMQkJT+bMhDLxpjxSbLC21LLdxioCAPYGl6tywECgYEAlAQVNYRn79WoWYmcLCH2
BI/Z8bAJXShrUts0bSSApnLVLfUPJr1HjISe/+u5mJkCLAaFgi1/N2Xeg72rHUxO
6oOzAxxJ0RBu6s1B055229OM/ZC5j9Fclt5oUwWUf3XIYjRVxu/7n0sRnjUr3LrE
G8uwb8tylDnHCy9InfR2NIE=
-----END PRIVATE KEY-----`

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2InNwRSkYhsbTSZY48HH
CqCfO+eBPk5U9+Ah060rBR/BKfmIOSk/7IUH4ADiJp26dNc6nddqRQcb+u91UsQB
ygifCmR/5VxduSssmhfxL3CGdP4H97fxz2ytBf06vak7a2CoFQN+hnS1KJiQIrIK
kOGdl5bugY0TK+8nvUmPMwcY225V2Ex74lZOnQs8c3OO0TaWP9yAywHmz7rUepec
D9taFryYUTwIWpCQuk32H7P7fFQowaejUiV+Z21YWpa32c6fduTIJa+Mb3rXtoQK
VX3CffBgMtReltKwkYWz6d5waDWwJg0b1h7GdyZoO7xqZ2Bx3UzB6QOMG2NhMSZS
WwIDAQAB
-----END PUBLIC KEY-----`

function signPayload(payload: unknown): string {
  const signer = createSign('RSA-SHA256')
  signer.update(JSON.stringify(payload))
  signer.end()
  return signer.sign(TEST_PRIVATE_KEY, 'base64')
}

function renderTracePage(): void {
  render(React.createElement(TracePage))
}

describe('TracePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows verified state for a valid signed payload', async () => {
    const payload = {
      id: 'batch-123',
      productName: 'Cassava Flour',
      farmName: 'Farm Alpha',
      createdAt: '2026-03-29T10:00:00.000Z',
      story: 'Harvested by cooperative members',
      timeline: [{ at: '2026-03-28T09:00:00.000Z', label: 'Batch created' }]
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payload,
        signature: signPayload(payload),
        publicKeyPem: TEST_PUBLIC_KEY,
        algorithm: 'RSA-SHA256'
      })
    }))

    renderTracePage()

    expect(await screen.findByText('Cassava Flour')).toBeInTheDocument()
    expect(screen.getByText('Verified provenance')).toBeInTheDocument()
  })

  it('shows fallback state when signature is invalid', async () => {
    const payload = {
      id: 'batch-123',
      productName: 'Cassava Flour',
      farmName: 'Farm Alpha',
      createdAt: '2026-03-29T10:00:00.000Z',
      story: null,
      timeline: [{ at: '2026-03-28T09:00:00.000Z', label: 'Batch created' }]
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payload,
        signature: 'invalid-signature',
        publicKeyPem: TEST_PUBLIC_KEY,
        algorithm: 'RSA-SHA256'
      })
    }))

    renderTracePage()

    expect(await screen.findByText('Unable to verify provenance signature.')).toBeInTheDocument()
  })

  it('shows not found state when batch does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    }))

    renderTracePage()

    expect(await screen.findByText('Trace record not found.')).toBeInTheDocument()
  })
})
