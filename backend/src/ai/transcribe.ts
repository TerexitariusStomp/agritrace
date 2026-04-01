import path from 'node:path'
import { db } from '../db.js'

type TranscribeInput = {
  voiceNoteId: string
}

function normalizeFilename(filePath: string): string {
  const fileName = path.basename(filePath)
  return fileName.replace(/^[0-9a-f-]+-/i, '')
}

export async function transcribeVoiceNote(input: TranscribeInput): Promise<string> {
  if (!input.voiceNoteId) {
    throw new Error('Missing voice note id for transcription')
  }

  const voiceNote = db
    .prepare('SELECT id, file_path, language FROM voice_notes WHERE id = ? LIMIT 1')
    .get(input.voiceNoteId) as { id: string; file_path: string; language: string | null } | undefined

  if (!voiceNote) {
    throw new Error(`Voice note not found: ${input.voiceNoteId}`)
  }

  const language = voiceNote.language?.trim() || 'auto'
  const transcript = `[transcribed:${language}] ${normalizeFilename(voiceNote.file_path)}`
  db.prepare('UPDATE voice_notes SET transcript = ? WHERE id = ?').run(transcript, voiceNote.id)

  return transcript
}
