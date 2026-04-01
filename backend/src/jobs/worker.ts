import { db } from '../db.js'
import { identifyPlant } from '../ai/plant-id.js'
import { transcribeVoiceNote } from '../ai/transcribe.js'
import { dequeueAiJobId } from './queue.js'

type JobRow = {
  id: string
  type: 'transcribe' | 'plant_id'
  entity_id: string | null
  payload_json: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runWorkerOnce(): Promise<boolean> {
  const startedAt = nowIso()

  const claimById = (id: string): JobRow | null => {
    const claimed = db
      .prepare(
        `UPDATE ai_jobs
         SET status = ?, attempts = attempts + 1, started_at = ?, updated_at = ?, error_message = NULL
         WHERE id = ? AND status = 'queued'`
      )
      .run('processing', startedAt, startedAt, id)
    if (claimed.changes !== 1) {
      return null
    }

    return db
      .prepare('SELECT id, type, entity_id, payload_json FROM ai_jobs WHERE id = ? LIMIT 1')
      .get(id) as JobRow | null
  }

  const claimNextQueued = (): JobRow | null => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = db
        .prepare("SELECT id FROM ai_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1")
        .get() as { id: string } | undefined

      if (!next) {
        return null
      }

      const claimed = claimById(next.id)
      if (claimed) {
        return claimed
      }
    }

    return null
  }

  const hintedJobId = await dequeueAiJobId()
  const job = hintedJobId ? claimById(hintedJobId) ?? claimNextQueued() : claimNextQueued()
  if (!job) {
    return false
  }

  try {
    const payload = JSON.parse(job.payload_json) as { voiceNoteId?: string; photoId?: string }
    if (job.type === 'transcribe') {
      await transcribeVoiceNote({ voiceNoteId: payload.voiceNoteId ?? job.entity_id ?? '' })
    } else {
      await identifyPlant({ photoId: payload.photoId ?? job.entity_id ?? '' })
    }

    const completedAt = nowIso()
    db.prepare(
      'UPDATE ai_jobs SET status = ?, completed_at = ?, updated_at = ?, error_message = NULL WHERE id = ?'
    ).run('completed', completedAt, completedAt, job.id)
    return true
  } catch (error) {
    const failedAt = nowIso()
    const message = error instanceof Error ? error.message : 'Unknown worker error'
    db.prepare(
      'UPDATE ai_jobs SET status = ?, updated_at = ?, error_message = ? WHERE id = ?'
    ).run('failed', failedAt, message, job.id)
    return true
  }
}

export async function startWorkerLoop(pollIntervalMs = 750): Promise<void> {
  for (;;) {
    const didProcess = await runWorkerOnce()
    if (!didProcess) {
      await sleep(pollIntervalMs)
    }
  }
}

if (process.argv.includes('--run')) {
  startWorkerLoop().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
