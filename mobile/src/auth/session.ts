import { apiClient, type ApiClient } from '../api/client'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: 'farmer' | 'evaluator' | 'manager' | 'consumer'
  locale: string
}

export type AuthSession = {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

type LoginInput = {
  email: string
  password: string
}

let activeSession: AuthSession | null = null

export function getSession(): AuthSession | null {
  return activeSession
}

export function clearSession(): void {
  activeSession = null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function loginWithPassword(input: LoginInput, client: ApiClient = apiClient): Promise<AuthSession> {
  const session = await client.post<AuthSession, LoginInput>('/auth/login', {
    email: normalizeEmail(input.email),
    password: input.password
  })

  activeSession = session
  return session
}
