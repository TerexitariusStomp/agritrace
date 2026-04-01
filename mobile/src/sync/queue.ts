const QUEUE_KEY = 'agritrace-mobile-offline-queue'

export type QueuedAction = {
  id: string
  label: string
  createdAt: string
  payload?: Record<string, unknown>
}

type QueueStorage = {
  read: () => Promise<string | null>
  write: (value: string) => Promise<void>
}

let rawQueue = '[]'
let storageInitialized = false

let storage: QueueStorage = {
  async read() {
    return rawQueue
  },
  async write(value: string) {
    rawQueue = value
  }
}

async function initializeDefaultStorage(): Promise<void> {
  if (storageInitialized) {
    return
  }
  storageInitialized = true

  try {
    const module = await import('@react-native-async-storage/async-storage')
    const AsyncStorage = module.default
    storage = {
      read: () => AsyncStorage.getItem(QUEUE_KEY),
      write: (value: string) => AsyncStorage.setItem(QUEUE_KEY, value)
    }
  } catch {
    // keep deterministic in-memory fallback for tests and non-native runtimes
  }
}

export function setQueueStorage(nextStorage: QueueStorage): void {
  storage = nextStorage
}

function parseQueue(raw: string | null): QueuedAction[] {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as QueuedAction[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function readQueue(): Promise<QueuedAction[]> {
  await initializeDefaultStorage()
  return parseQueue(await storage.read())
}

async function writeQueue(queue: QueuedAction[]): Promise<void> {
  await initializeDefaultStorage()
  await storage.write(JSON.stringify(queue))
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  return readQueue()
}

export async function queueLocalAction(label: string, payload?: Record<string, unknown>): Promise<number> {
  const queue = await readQueue()
  const createdAt = new Date().toISOString()
  const action: QueuedAction = {
    id: `${Date.now()}-${queue.length + 1}`,
    label,
    createdAt,
    ...(payload ? { payload } : {})
  }
  const next = [...queue, action]
  await writeQueue(next)
  return next.length
}

export async function flushLocalQueue(send: (action: QueuedAction) => Promise<void>): Promise<number> {
  const queue = await readQueue()
  if (queue.length === 0) {
    return 0
  }

  let sent = 0
  for (const action of queue) {
    await send(action)
    sent += 1
  }

  await writeQueue([])
  return sent
}

export async function clearLocalQueue(): Promise<void> {
  await writeQueue([])
}

export { QUEUE_KEY }
