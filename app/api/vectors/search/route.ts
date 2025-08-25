import { type NextRequest, NextResponse } from "next/server"
import { RedisVectorStore } from "@/lib/redis-vector"

export async function POST(request: NextRequest) {
  try {
    const { query, openaiKey, redisVectorUrl, redisVectorPassword, limit = 5, threshold = 0.7 } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // Generate embedding for the query
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    })

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.status}`)
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // Search for similar chunks
    const vectorStore = new RedisVectorStore(redisVectorUrl, redisVectorPassword)
    const results = await vectorStore.searchSimilar(queryEmbedding, limit, threshold)
    await vectorStore.disconnect()

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    })
  } catch (error) {
    console.error("Vector search error:", error)
    return NextResponse.json({ error: "Failed to search vectors" }, { status: 500 })
  }
}
