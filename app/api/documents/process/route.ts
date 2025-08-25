import { type NextRequest, NextResponse } from "next/server"

interface DocumentProcessRequest {
  url: string
  documentId: string
  openaiKey: string
}

interface DocumentChunk {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  metadata: {
    startChar: number
    endChar: number
    wordCount: number
  }
  embedding?: number[] | null
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const { url, documentId, openaiKey }: DocumentProcessRequest = await request.json()

    if (!url || !documentId || !openaiKey) {
      return NextResponse.json(
        {
          error: "Missing required parameters: url, documentId, and openaiKey are required",
        },
        { status: 400 },
      )
    }

    console.log("[v0] Processing document:", url)

    const docId = extractGoogleDocId(url)
    if (!docId) {
      return NextResponse.json({ error: "Invalid Google Docs URL" }, { status: 400 })
    }

    console.log("[v0] Extracted doc ID:", docId)

    const content = await fetchGoogleDocContent(docId)
    if (!content) {
      return NextResponse.json({ error: "Failed to fetch document content" }, { status: 400 })
    }

    console.log("[v0] Fetched content length:", content.length)

    const chunks = chunkDocument(content, documentId)
    console.log("[v0] Created chunks:", chunks.length)

    const chunksWithEmbeddings = await generateEmbeddings(chunks, openaiKey)
    console.log("[v0] Generated embeddings for chunks")

    return NextResponse.json({
      success: true,
      documentId,
      chunksCount: chunks.length,
      chunks: chunksWithEmbeddings,
    })
  } catch (error) {
    console.error("Document processing error:", error)
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 })
  }
}

function extractGoogleDocId(url: string): string | null {
  if (!url || typeof url !== "string") {
    console.error("[v0] Invalid URL provided:", url)
    return null
  }

  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

async function fetchGoogleDocContent(docId: string): Promise<string | null> {
  try {
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`
    console.log("[v0] Fetching from URL:", exportUrl)

    let response = await fetch(exportUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "text/plain,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    })

    console.log("[v0] Response status:", response.status)
    console.log("[v0] Response URL:", response.url)

    if (response.status === 307 || response.status === 302) {
      const location = response.headers.get("location")
      console.log("[v0] Manual redirect to:", location)

      if (location) {
        response = await fetch(location, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "text/plain,*/*",
          },
        })
        console.log("[v0] Redirect response status:", response.status)
      }
    }

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        throw new Error(
          "Document is not publicly accessible. Please make sure the Google Doc is shared with 'Anyone with the link can view' permissions.",
        )
      }
      throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`)
    }

    const content = await response.text()
    console.log("[v0] Content preview:", content.substring(0, 200) + "...")

    if (content.includes("Access denied") || content.includes("Sign in") || content.includes("Request access")) {
      throw new Error(
        "Document is not publicly accessible. Please share the Google Doc with 'Anyone with the link can view' permissions.",
      )
    }

    if (!content || content.trim().length === 0) {
      throw new Error("Document appears to be empty or inaccessible")
    }

    return content.trim()
  } catch (error) {
    console.error("Error fetching Google Doc:", error)
    return null
  }
}

function chunkDocument(content: string, documentId: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  const maxChunkSize = 800 // tokens (roughly 600-800 words)
  const overlapSize = 100 // tokens overlap between chunks

  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0)

  let currentChunk = ""
  let chunkIndex = 0
  let startChar = 0

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue

    const estimatedTokens = (currentChunk + trimmedSentence).length / 4

    if (estimatedTokens > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        content: currentChunk.trim(),
        chunkIndex,
        metadata: {
          startChar,
          endChar: startChar + currentChunk.length,
          wordCount: currentChunk.split(/\s+/).length,
        },
      })

      const words = currentChunk.split(/\s+/)
      const overlapWords = words.slice(-Math.floor(overlapSize / 4))
      currentChunk = overlapWords.join(" ") + " " + trimmedSentence
      startChar += currentChunk.length - (overlapWords.join(" ").length + trimmedSentence.length)
      chunkIndex++
    } else {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: `${documentId}_chunk_${chunkIndex}`,
      documentId,
      content: currentChunk.trim(),
      chunkIndex,
      metadata: {
        startChar,
        endChar: startChar + currentChunk.length,
        wordCount: currentChunk.split(/\s+/).length,
      },
    })
  }

  return chunks
}

async function generateEmbeddings(chunks: DocumentChunk[], openaiKey: string) {
  const chunksWithEmbeddings: DocumentChunk[] = []

  for (const chunk of chunks) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: chunk.content,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const embedding = data.data[0].embedding

      chunksWithEmbeddings.push({
        ...chunk,
        embedding,
      })
    } catch (error) {
      console.error(`Error generating embedding for chunk ${chunk.id}:`, error)
      chunksWithEmbeddings.push({
        ...chunk,
        embedding: null,
        error: "Failed to generate embedding",
      })
    }
  }

  return chunksWithEmbeddings
}
