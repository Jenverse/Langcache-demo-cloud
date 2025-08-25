import { type NextRequest, NextResponse } from "next/server"
import { RAGSystem, type RAGDocument } from "@/lib/rag-system"

export async function POST(request: NextRequest) {
  try {
    const { url, openaiKey, redisUrl, redisPassword } = await request.json()

    if (!url || !openaiKey || !redisUrl) {
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

    // Extract document ID from Google Docs URL
    const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)
    if (!docIdMatch) {
      return NextResponse.json({ error: "Invalid Google Docs URL" }, { status: 400 })
    }

    const docId = docIdMatch[1]

    const content = await ragSystem.fetchGoogleDoc(docId)
    const chunks = ragSystem.chunkDocument(content, docId)
    const chunksWithEmbeddings = await ragSystem.generateEmbeddings(chunks)

    // Create RAG document
    const document: RAGDocument = {
      id: docId,
      name: `Document ${docId}`,
      url,
      content,
      chunks: chunksWithEmbeddings,
      metadata: {
        wordCount: content.split(/\s+/).length,
        chunkCount: chunksWithEmbeddings.length,
        processedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
    }

    // Store in Redis
    await ragSystem.storeDocument(document)

    return NextResponse.json({
      success: true,
      documentId: docId,
      chunksCount: chunksWithEmbeddings.length,
      wordCount: document.metadata.wordCount,
      status: "processed",
    })
  } catch (error) {
    console.error("RAG processing error:", error)
    return NextResponse.json({ error: error.message || "Failed to process document" }, { status: 500 })
  }
}
