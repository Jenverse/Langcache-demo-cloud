import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { openaiKey, langcacheUrl, cacheId, serviceKey } = await request.json()

    const results: { openai?: boolean; langcache?: boolean; error?: string } = {}

    // Test OpenAI connection
    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
      })
      results.openai = openaiResponse.ok
    } catch {
      results.openai = false
    }

    // Test LangCache connection
    try {
      const langcacheResponse = await fetch(`${langcacheUrl}/v1/caches/${cacheId}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: "test" }),
      })
      results.langcache = langcacheResponse.ok || langcacheResponse.status === 404 // 404 is ok for empty cache
    } catch {
      results.langcache = false
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({ error: "Failed to test connections" }, { status: 500 })
  }
}
