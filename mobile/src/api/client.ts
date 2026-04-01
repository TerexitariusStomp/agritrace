const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type JsonObject = { [key: string]: unknown }

export type ApiClient = {
  post<TResponse, TBody extends JsonObject>(
    path: string,
    body: TBody,
    token?: string
  ): Promise<TResponse>
}

function trimBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

async function readBody(response: Response): Promise<JsonObject | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return (await response.json()) as JsonObject
  } catch {
    return null
  }
}

export function createApiClient(baseUrl = DEFAULT_API_BASE_URL): ApiClient {
  const normalizedBaseUrl = trimBaseUrl(baseUrl)

  return {
    async post<TResponse, TBody extends JsonObject>(path: string, body: TBody, token?: string): Promise<TResponse> {
      const response = await fetch(`${normalizedBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      })

      const parsedBody = await readBody(response)
      if (!response.ok) {
        const message =
          parsedBody && typeof parsedBody.error === 'string' ? parsedBody.error : `Request failed (${response.status})`
        throw new ApiError(response.status, message)
      }

      if (!parsedBody) {
        throw new ApiError(response.status, 'Expected JSON response body')
      }

      return parsedBody as TResponse
    }
  }
}

export const apiClient = createApiClient()
