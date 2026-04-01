import { createSign, createVerify } from 'node:crypto'

export type TraceEnvelope<TPayload> = {
  payload: TPayload
  signature: string
  publicKeyPem: string
  algorithm: 'RSA-SHA256'
}

function getTracePrivateKey(): string {
  const key = process.env.TRACE_SIGNING_PRIVATE_KEY_PEM?.trim()
  if (!key) {
    throw new Error('TRACE_SIGNING_PRIVATE_KEY_PEM is required')
  }
  return key
}

function getTracePublicKey(): string {
  const key = process.env.TRACE_SIGNING_PUBLIC_KEY_PEM?.trim()
  if (!key) {
    throw new Error('TRACE_SIGNING_PUBLIC_KEY_PEM is required')
  }
  return key
}

function serializePayload(payload: unknown): string {
  return JSON.stringify(payload)
}

export function signTracePayload<TPayload>(payload: TPayload): TraceEnvelope<TPayload> {
  const signer = createSign('RSA-SHA256')
  signer.update(serializePayload(payload))
  signer.end()

  return {
    payload,
    signature: signer.sign(getTracePrivateKey(), 'base64'),
    publicKeyPem: getTracePublicKey(),
    algorithm: 'RSA-SHA256'
  }
}

export function verifyTraceEnvelope<TPayload>(envelope: TraceEnvelope<TPayload>): boolean {
  if (envelope.algorithm !== 'RSA-SHA256') {
    return false
  }

  const verifier = createVerify('RSA-SHA256')
  verifier.update(serializePayload(envelope.payload))
  verifier.end()
  return verifier.verify(envelope.publicKeyPem, envelope.signature, 'base64')
}
