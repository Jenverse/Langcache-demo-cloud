import { type NextRequest, NextResponse } from "next/server"
import { RAGSystem } from "@/lib/rag-system"

export async function POST(request: NextRequest) {
  try {
    const { query, openaiKey, redisUrl, redisPassword, limit = 5 } = await request.json()

    if (!query || !openaiKey || !redisUrl) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const ragSystem = new RAGSystem({
      openaiKey,
      redisUrl,
      redisPassword,
      chunkSize: 800,
      chunkOverlap: 100,
      similarityThreshold: 0.7,
    })

    const similarChunks = await ragSystem.searchSimilarChunks(query, limit)

    return NextResponse.json({
      success: true,
      query,
      results: similarChunks,
      count: similarChunks.length,
    })
  } catch (error) {
    console.error("RAG search error:", error)
    return NextResponse.json({ error: error.message || "Failed to search documents" }, { status: 500 })
  }
}
