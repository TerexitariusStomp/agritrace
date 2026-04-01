import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Client } from 'minio'

export type StorageProvider = 'minio' | 'local'

export type PutObjectInput = {
  bucket: string
  objectKey: string
  body: Buffer
  contentType: string
}

export type PutObjectResult = {
  bucket: string
  objectKey: string
  provider: StorageProvider
}

export interface MediaStorageAdapter {
  putObject(input: PutObjectInput): Promise<PutObjectResult>
  deleteObject(input: { bucket: string; objectKey: string }): Promise<void>
}

type ResolvedMediaStorage = {
  adapter: MediaStorageAdapter
  bucket: string
  provider: StorageProvider
}

const FALLBACK_BUCKET = process.env.MEDIA_BUCKET ?? 'agrotrace-media'

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).trim()
  const normalized = base.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
  return normalized.length > 0 ? normalized.toLowerCase() : 'file.bin'
}

export function buildPhotoObjectKey(input: { category: string; id: string; filename: string }): string {
  const safeFile = sanitizeFilename(input.filename)
  return `photos/${input.category}/${input.id}-${safeFile}`
}

class LocalMediaStorageAdapter implements MediaStorageAdapter {
  private readonly rootDir: string

  constructor(rootDir: string) {
    this.rootDir = rootDir
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const objectPath = path.join(this.rootDir, input.bucket, ...input.objectKey.split('/'))
    const objectDir = path.dirname(objectPath)
    await fs.promises.mkdir(objectDir, { recursive: true })
    await fs.promises.writeFile(objectPath, input.body)
    return {
      bucket: input.bucket,
      objectKey: input.objectKey,
      provider: 'local'
    }
  }

  async deleteObject(input: { bucket: string; objectKey: string }): Promise<void> {
    const objectPath = path.join(this.rootDir, input.bucket, ...input.objectKey.split('/'))
    try {
      await fs.promises.unlink(objectPath)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        throw error
      }
    }
  }
}

class MinioMediaStorageAdapter implements MediaStorageAdapter {
  private readonly client: Client
  private readonly ensureBucket: Promise<void>

  constructor(client: Client, bucket: string) {
    this.client = client
    this.ensureBucket = this.initializeBucket(bucket)
  }

  private async initializeBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket)
    if (!exists) {
      await this.client.makeBucket(bucket, 'us-east-1')
    }
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    await this.ensureBucket
    await this.client.putObject(input.bucket, input.objectKey, input.body, input.body.byteLength, {
      'Content-Type': input.contentType
    })
    return {
      bucket: input.bucket,
      objectKey: input.objectKey,
      provider: 'minio'
    }
  }

  async deleteObject(input: { bucket: string; objectKey: string }): Promise<void> {
    await this.ensureBucket
    await this.client.removeObject(input.bucket, input.objectKey)
  }
}

let cachedStorage: ResolvedMediaStorage | null = null

function createLocalFallbackStorage(): ResolvedMediaStorage {
  const srcDir = path.dirname(fileURLToPath(import.meta.url))
  const backendRoot = path.resolve(srcDir, '..', '..')
  const rootDir = path.join(backendRoot, 'uploads', 'media-fallback')
  return {
    adapter: new LocalMediaStorageAdapter(rootDir),
    bucket: FALLBACK_BUCKET,
    provider: 'local'
  }
}

function shouldUseMinio(): boolean {
  return Boolean(
    process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY
  )
}

function createMinioStorage(): ResolvedMediaStorage {
  const endpoint = process.env.MINIO_ENDPOINT as string
  const accessKey = process.env.MINIO_ACCESS_KEY as string
  const secretKey = process.env.MINIO_SECRET_KEY as string
  const port = Number(process.env.MINIO_PORT ?? '9000')
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid MINIO_PORT: ${process.env.MINIO_PORT ?? 'undefined'}`)
  }
  const useSSL = process.env.MINIO_USE_SSL === 'true'
  const bucket = process.env.MINIO_BUCKET ?? FALLBACK_BUCKET
  const client = new Client({ endPoint: endpoint, port, useSSL, accessKey, secretKey })

  return {
    adapter: new MinioMediaStorageAdapter(client, bucket),
    bucket,
    provider: 'minio'
  }
}

export function getMediaStorage(): ResolvedMediaStorage {
  if (!cachedStorage) {
    cachedStorage = shouldUseMinio() ? createMinioStorage() : createLocalFallbackStorage()
  }
  return cachedStorage
}
