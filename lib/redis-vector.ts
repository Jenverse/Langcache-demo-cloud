interface VectorChunk {
  id: string
  documentId: string
  content: string
  embedding: number[]
  metadata: {
    chunkIndex: number
    startChar: number
    endChar: number
    wordCount: number
  }
}

interface SearchResult {
  id: string
  documentId: string
  content: string
  score: number
  metadata: any
}

class RedisVectorStore {
  private connected = false
  private redisHost: string
  private redisPort: string
  private redisPassword: string

  constructor(
    private url: string,
    private password?: string,
  ) {
    // Parse Redis URL to extract host, port, and credentials
    const parsedUrl = this.parseRedisUrl(url)
    this.redisHost = parsedUrl.host
    this.redisPort = parsedUrl.port
    this.redisPassword = parsedUrl.password || password || ""
  }

  private parseRedisUrl(url: string): { host: string; port: string; password: string } {
    try {
      // Handle redis://user:password@host:port format
      const urlObj = new URL(url.startsWith("redis://") ? url : `redis://${url}`)
      return {
        host: urlObj.hostname,
        port: urlObj.port || "6379",
        password: urlObj.password || "",
      }
    } catch {
      // Fallback parsing for Redis Cloud URLs
      const match = url.match(/([^:]+):(\d+)/)
      if (match) {
        return {
          host: match[1],
          port: match[2],
          password: this.password || "",
        }
      }
      throw new Error("Invalid Redis URL format")
    }
  }

  async connect() {
    if (this.connected) return

    try {
      console.log("[v0] Connecting to Redis with host:", this.redisHost.substring(0, 20) + "...")

      // Test connection with a simple ping
      await this.executeRedisCommand("PING")
      this.connected = true
      console.log("[v0] Connected to Redis vector database successfully")
    } catch (error) {
      console.error("[v0] Failed to connect to Redis:", error)
      throw error
    }
  }

  async disconnect() {
    this.connected = false
  }

  private async executeRedisCommand(command: string, ...args: string[]): Promise<any> {
    try {
      const auth = Buffer.from(`:${this.redisPassword}`).toString("base64")
      const response = await fetch(`https://${this.redisHost}:${this.redisPort}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([command, ...args]),
      })

      if (!response.ok) {
        throw new Error(`Redis command failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`[v0] Redis command ${command} failed:`, error)
      throw error
    }
  }

  async storeChunks(chunks: VectorChunk[]): Promise<void> {
    await this.connect()

    for (const chunk of chunks) {
      const key = `doc:${chunk.documentId}:chunk:${chunk.id}`

      console.log(`[v0] Storing chunk ${chunk.id} for document ${chunk.documentId}`)

      try {
        await this.executeRedisCommand(
          "HSET",
          key,
          "id",
          chunk.id,
          "documentId",
          chunk.documentId,
          "content",
          chunk.content,
          "embedding",
          JSON.stringify(chunk.embedding),
          "metadata",
          JSON.stringify(chunk.metadata),
          "timestamp",
          Date.now().toString(),
        )

        // Add to document index
        await this.executeRedisCommand("SADD", `doc:${chunk.documentId}:chunks`, chunk.id)
        console.log(`[v0] Successfully stored chunk ${chunk.id}`)
      } catch (error) {
        console.error(`[v0] Failed to store chunk ${chunk.id}:`, error)
        throw error
      }
    }
  }

  async searchSimilar(queryEmbedding: number[], limit = 5, threshold = 0.7): Promise<SearchResult[]> {
    await this.connect()

    console.log(`[v0] Searching for similar vectors with threshold ${threshold}`)

    try {
      // Get all document chunks
      const documentKeys = await this.executeRedisCommand("KEYS", "doc:*:chunk:*")
      const results: SearchResult[] = []

      for (const key of documentKeys) {
        try {
          const chunkData = await this.executeRedisCommand("HGETALL", key)
          if (chunkData && chunkData.embedding) {
            const embedding = JSON.parse(chunkData.embedding)
            const similarity = this.cosineSimilarity(queryEmbedding, embedding)

            if (similarity >= threshold) {
              results.push({
                id: chunkData.id,
                documentId: chunkData.documentId,
                content: chunkData.content,
                score: similarity,
                metadata: JSON.parse(chunkData.metadata || "{}"),
              })
            }
          }
        } catch (error) {
          console.error(`[v0] Error processing chunk ${key}:`, error)
        }
      }

      // Sort by similarity score and return top results
      return results.sort((a, b) => b.score - a.score).slice(0, limit)
    } catch (error) {
      console.error("[v0] Vector search failed:", error)
      return []
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.connect()
    console.log(`[v0] Deleting document ${documentId}`)

    try {
      const chunkIds = await this.executeRedisCommand("SMEMBERS", `doc:${documentId}:chunks`)

      for (const chunkId of chunkIds) {
        await this.executeRedisCommand("DEL", `doc:${documentId}:chunk:${chunkId}`)
      }

      await this.executeRedisCommand("DEL", `doc:${documentId}:chunks`)
      console.log(`[v0] Successfully deleted document ${documentId}`)
    } catch (error) {
      console.error(`[v0] Failed to delete document ${documentId}:`, error)
      throw error
    }
  }

  async listDocuments(): Promise<string[]> {
    await this.connect()
    console.log("[v0] Listing documents")

    try {
      const keys = await this.executeRedisCommand("KEYS", "doc:*:chunks")
      const documentIds = keys
        .map((key: string) => {
          const match = key.match(/doc:([^:]+):chunks/)
          return match ? match[1] : null
        })
        .filter(Boolean)

      return [...new Set(documentIds)] // Remove duplicates
    } catch (error) {
      console.error("[v0] Failed to list documents:", error)
      return []
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}

export { RedisVectorStore, type VectorChunk, type SearchResult }
