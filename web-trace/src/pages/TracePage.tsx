import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Timeline, type TimelineItem } from '../components/Timeline'

type TracePayload = {
  id: string
  productName: string
  farmName: string
  story: string | null
  nutrition: Record<string, unknown> | null
  createdAt: string | null
  timeline: TimelineItem[]
}

type TraceEnvelope = {
  payload: TracePayload
  signature: string
  publicKeyPem: string
  algorithm: 'RSA-SHA256'
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000'

type TraceStatus = 'loading' | 'verified' | 'invalid-signature' | 'not-found' | 'error'

function pemToUint8Array(pem: string): Uint8Array {
  const clean = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function signatureToUint8Array(signature: string): Uint8Array {
  const binary = atob(signature)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function verifyTraceEnvelope(envelope: TraceEnvelope): Promise<boolean> {
  if (envelope.algorithm !== 'RSA-SHA256') {
    return false
  }

  try {
    const key = await crypto.subtle.importKey(
      'spki',
      pemToUint8Array(envelope.publicKeyPem),
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['verify']
    )

    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signatureToUint8Array(envelope.signature),
      new TextEncoder().encode(JSON.stringify(envelope.payload))
    )
  } catch {
    return false
  }
}

export function TracePage() {
  const { id } = useParams()
  const [status, setStatus] = useState<TraceStatus>('loading')
  const [payload, setPayload] = useState<TracePayload | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadTrace() {
      if (!id) {
        setStatus('error')
        return
      }

      setStatus('loading')

      try {
        const response = await fetch(`${API_BASE_URL}/public/trace/${id}`)
        if (response.status === 404) {
          if (isMounted) {
            setStatus('not-found')
          }
          return
        }

        if (!response.ok) {
          if (isMounted) {
            setStatus('error')
          }
          return
        }

        const envelope = (await response.json()) as TraceEnvelope
        const verified = await verifyTraceEnvelope(envelope)
        if (!isMounted) {
          return
        }

        if (!verified) {
          setStatus('invalid-signature')
          return
        }

        setPayload(envelope.payload)
        setStatus('verified')
      } catch {
        if (isMounted) {
          setStatus('error')
        }
      }
    }

    void loadTrace()

    return () => {
      isMounted = false
    }
  }, [id])

  if (status === 'loading') {
    return <main className="trace-shell">Loading trace...</main>
  }

  if (status === 'not-found') {
    return <main className="trace-shell">Trace record not found.</main>
  }

  if (status === 'invalid-signature') {
    return <main className="trace-shell">Unable to verify provenance signature.</main>
  }

  if (status === 'error' || !payload) {
    return <main className="trace-shell">Unable to load trace details right now.</main>
  }

  return (
    <main className="trace-shell">
      <section className="trace-card">
        <p className="trace-badge">Verified provenance</p>
        <h1>{payload.productName}</h1>
        <p>
          Batch <strong>{payload.id}</strong> from {payload.farmName}
        </p>
        {payload.story ? <p>{payload.story}</p> : null}
      </section>

      <section className="trace-card">
        <h2>Trace timeline</h2>
        <Timeline items={payload.timeline} />
      </section>
    </main>
  )
}
