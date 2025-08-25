import { type NextRequest, NextResponse } from "next/server"
import { RedisVectorStore } from "@/lib/redis-vector"

export async function POST(request: NextRequest) {
  try {
    const { chunks, redisVectorUrl, redisVectorPassword } = await request.json()

    if (!chunks || !Array.isArray(chunks)) {
      return NextResponse.json({ error: "Invalid chunks data" }, { status: 400 })
    }

    const vectorStore = new RedisVectorStore(redisVectorUrl, redisVectorPassword)

    await vectorStore.storeChunks(chunks)
    await vectorStore.disconnect()

    return NextResponse.json({
      success: true,
      stored: chunks.length,
      message: `Successfully stored ${chunks.length} chunks`,
    })
  } catch (error) {
    console.error("Vector storage error:", error)
    return NextResponse.json({ error: "Failed to store vectors" }, { status: 500 })
  }
}
