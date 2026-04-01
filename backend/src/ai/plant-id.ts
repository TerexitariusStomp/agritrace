import { db } from '../db.js'

type PlantIdInput = {
  photoId: string
}

export async function identifyPlant(input: PlantIdInput): Promise<string> {
  if (!input.photoId) {
    throw new Error('Missing photo id for plant identification')
  }

  const row = db.prepare('SELECT id FROM photos WHERE id = ? LIMIT 1').get(input.photoId) as { id: string } | undefined
  if (!row) {
    throw new Error(`Photo not found: ${input.photoId}`)
  }

  const species = 'Unknown species (worker stub)'
  db.prepare('UPDATE photos SET species = ? WHERE id = ?').run(species, row.id)
  return species
}
