export interface RAGDocument {
  id: string
  name: string
  url: string
  content: string
  chunks: DocumentChunk[]
  metadata: {
    wordCount: number
    chunkCount: number
    processedAt: string
    lastUpdated: string
  }
}

export interface DocumentChunk {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  embedding: number[]
  metadata: {
    startChar: number
    endChar: number
    wordCount: number
    sentenceCount: number
  }
}

export interface RAGConfig {
  openaiKey: string
  redisUrl: string
  redisPassword: string
  chunkSize: number
  chunkOverlap: number
  similarityThreshold: number
}

export class RAGSystem {
  private config: RAGConfig
  private redis: any

  constructor(config: RAGConfig) {
    this.config = config
  }

  async fetchGoogleDoc(docId: string): Promise<string> {
    // For now, we'll use a more robust approach to fetch public docs
    // In production, this should use Google Docs API with OAuth
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`

    try {
      const response = await fetch(exportUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RAG-System/1.0)",
          Accept: "text/plain",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status}`)
      }

      const content = await response.text()

      if (content.includes("Access denied") || content.includes("Sign in")) {
        throw new Error('Document is not publicly accessible. Please share with "Anyone with the link can view"')
      }

      return content
    } catch (error) {
      throw new Error(`Google Docs fetch failed: ${error.message}`)
    }
  }

  chunkDocument(content: string, documentId: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const { chunkSize, chunkOverlap } = this.config

    // Split into sentences while preserving structure
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content]

    let currentChunk = ""
    let chunkIndex = 0
    let startChar = 0

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      if (!sentence) continue

      const potentialChunk = currentChunk + (currentChunk ? " " : "") + sentence
      const estimatedTokens = potentialChunk.length / 4 // Rough token estimation

      if (estimatedTokens > chunkSize && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          id: `${documentId}_chunk_${chunkIndex}`,
          documentId,
          content: currentChunk.trim(),
          chunkIndex,
          embedding: [], // Will be filled by generateEmbeddings
          metadata: {
            startChar,
            endChar: startChar + currentChunk.length,
            wordCount: currentChunk.split(/\s+/).length,
            sentenceCount: currentChunk.match(/[.!?]+/g)?.length || 1,
          },
        })

        // Handle overlap
        const words = currentChunk.split(/\s+/)
        const overlapWords = words.slice(-Math.floor(chunkOverlap / 4))
        currentChunk = overlapWords.join(" ") + " " + sentence
        startChar += currentChunk.length - overlapWords.join(" ").length
        chunkIndex++
      } else {
        currentChunk = potentialChunk
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        content: currentChunk.trim(),
        chunkIndex,
        embedding: [],
        metadata: {
          startChar,
          endChar: startChar + currentChunk.length,
          wordCount: currentChunk.split(/\s+/).length,
          sentenceCount: currentChunk.match(/[.!?]+/g)?.length || 1,
        },
      })
    }

    return chunks
  }

  async generateEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const batchSize = 10 // Process in batches to avoid rate limits
    const chunksWithEmbeddings: DocumentChunk[] = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)

      try {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: batch.map((chunk) => chunk.content),
          }),
        })

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()

        batch.forEach((chunk, index) => {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: data.data[index].embedding,
          })
        })
      } catch (error) {
        console.error(`Error generating embeddings for batch ${i}:`, error)
        // Add chunks without embeddings
        batch.forEach((chunk) => {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: [],
          })
        })
      }
    }

    return chunksWithEmbeddings
  }

  async storeDocument(document: RAGDocument): Promise<void> {
    // This would use Redis Stack with vector search capabilities
    // For now, we'll store in a structured format
    const redis = await this.getRedisClient()

    // Store document metadata
    await redis.hset(`doc:${document.id}`, {
      name: document.name,
      url: document.url,
      wordCount: document.metadata.wordCount,
      chunkCount: document.metadata.chunkCount,
      processedAt: document.metadata.processedAt,
    })

    // Store chunks with embeddings
    for (const chunk of document.chunks) {
      if (chunk.embedding.length > 0) {
        await redis.hset(`chunk:${chunk.id}`, {
          documentId: chunk.documentId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          embedding: JSON.stringify(chunk.embedding),
          metadata: JSON.stringify(chunk.metadata),
        })

        // Add to document's chunk list
        await redis.sadd(`doc:${document.id}:chunks`, chunk.id)
      }
    }
  }

  async searchSimilarChunks(query: string, limit = 5): Promise<DocumentChunk[]> {
    // Generate embedding for query
    const queryEmbedding = await this.generateQueryEmbedding(query)
    if (!queryEmbedding) return []

    // Get all chunks and calculate similarity
    const redis = await this.getRedisClient()
    const chunkKeys = await redis.keys("chunk:*")
    const similarChunks: Array<{ chunk: DocumentChunk; similarity: number }> = []

    for (const key of chunkKeys) {
      const chunkData = await redis.hgetall(key)
      if (!chunkData.embedding) continue

      const chunkEmbedding = JSON.parse(chunkData.embedding)
      const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding)

      if (similarity >= this.config.similarityThreshold) {
        similarChunks.push({
          chunk: {
            id: key.replace("chunk:", ""),
            documentId: chunkData.documentId,
            content: chunkData.content,
            chunkIndex: Number.parseInt(chunkData.chunkIndex),
            embedding: chunkEmbedding,
            metadata: JSON.parse(chunkData.metadata),
          },
          similarity,
        })
      }
    }

    // Sort by similarity and return top results
    return similarChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((item) => item.chunk)
  }

  private async generateQueryEmbedding(query: string): Promise<number[] | null> {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: query,
        }),
      })

      if (!response.ok) return null

      const data = await response.json()
      return data.data[0].embedding
    } catch (error) {
      console.error("Error generating query embedding:", error)
      return null
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

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  private async getRedisClient() {
    // Initialize Redis client if not already done
    // This would use the Redis configuration
    return {
      hset: async (key: string, data: any) => console.log("Redis HSET:", key),
      hgetall: async (key: string) => ({}),
      sadd: async (key: string, value: string) => console.log("Redis SADD:", key, value),
      keys: async (pattern: string) => [],
    }
  }
}
