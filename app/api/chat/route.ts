import { type NextRequest, NextResponse } from "next/server"

interface Config {
  openaiKey: string
  langcacheUrl: string
  cacheId: string
  serviceKey: string
  shadowMode: boolean
}

// ... existing searchLangCache and storeInLangCache functions ...

async function searchLangCache(query: string, config: Config) {
  try {
    if (!config.langcacheUrl || !config.cacheId || !config.serviceKey) {
      return { hit: false }
    }

    const url = `${config.langcacheUrl}/v1/caches/${config.cacheId}/entries/search`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: query.trim() }),
    })

    if (!response.ok) {
      console.log(`LangCache search failed: ${response.status}`)
      return { hit: false }
    }

    const result = await response.json()

    if (result?.data?.[0]?.response) {
      return {
        hit: true,
        response: result.data[0].response,
        similarity: result.data[0].similarity || 0,
        cachedQuery: result.data[0].prompt || query,
      }
    }

    return { hit: false }
  } catch (error) {
    console.error("LangCache search error:", error)
    return { hit: false }
  }
}

async function storeInLangCache(query: string, response: string, config: Config) {
  try {
    if (!config.langcacheUrl || !config.cacheId || !config.serviceKey) {
      return false
    }

    const url = `${config.langcacheUrl}/v1/caches/${config.cacheId}/entries`

    const storeResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: query.trim(),
        response: response.trim(),
        ttl_millis: 2592000000, // 30 days TTL
      }),
    })

    return storeResponse.ok
  } catch (error) {
    console.error("LangCache store error:", error)
    return false
  }
}

async function callOpenAI(query: string, config: Config) {
  const startTime = Date.now()

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: query }],
      max_tokens: 500,
    }),
  })

  const latency = Date.now() - startTime

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content || "No response generated"
  const tokensUsed = data.usage?.total_tokens || 0

  return { content, latency, tokensUsed }
}

export async function POST(request: NextRequest) {
  try {
    const { message, config } = await request.json()

    if (!message || !config) {
      return NextResponse.json({ error: "Missing message or config" }, { status: 400 })
    }

    console.log("📋 Configuration received:")
    console.log("  OpenAI Key:", config.openaiKey ? `${config.openaiKey.substring(0, 8)}...` : "❌ Missing")
    console.log("  LangCache URL:", config.langcacheUrl || "❌ Missing")
    console.log("  Cache ID:", config.cacheId || "❌ Missing")
    console.log("  Service Key:", config.serviceKey ? `${config.serviceKey.substring(0, 8)}...` : "❌ Missing")
    console.log("  Shadow Mode:", config.shadowMode ? "ON" : "OFF")
    console.log("  Message:", message)

    if (config.shadowMode) {
      // Shadow mode: Call both LangCache and OpenAI, always return OpenAI response
      const [cacheResult, openaiResult] = await Promise.all([
        searchLangCache(message, config),
        callOpenAI(message, config),
      ])

      // Store in cache if it was a miss (non-blocking)
      if (!cacheResult.hit) {
        storeInLangCache(message, openaiResult.content, config).catch(console.error)
      }

      return NextResponse.json({
        content: openaiResult.content, // Always return OpenAI response
        cached: false, // Always show as fresh in shadow mode
        shadowMode: true,
        cacheHit: cacheResult.hit, // For metrics tracking
        similarity: cacheResult.similarity,
        cachedQuery: cacheResult.cachedQuery,
        userQuery: message,
        latency: openaiResult.latency,
        tokensUsed: openaiResult.tokensUsed,
        // Calculate tokens that would have been saved if using cache
        tokensSaved: cacheResult.hit ? openaiResult.tokensUsed : 0,
      })
    } else {
      // Normal mode: Try LangCache first
      const cacheStartTime = Date.now()
      const cacheResult = await searchLangCache(message, config)
      const cacheLatency = Date.now() - cacheStartTime

      if (cacheResult.hit) {
        const estimatedInputTokens = Math.ceil(message.length / 4)
        const estimatedOutputTokens = Math.ceil(cacheResult.response.length / 4)
        const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens

        return NextResponse.json({
          content: cacheResult.response,
          cached: true,
          similarity: cacheResult.similarity,
          cachedQuery: cacheResult.cachedQuery,
          userQuery: message,
          latency: cacheLatency, // Use actual measured cache latency instead of 0
          tokensSaved: estimatedTotalTokens,
        })
      }

      // Cache miss - call OpenAI
      const openaiResult = await callOpenAI(message, config)

      // Store in cache (non-blocking)
      storeInLangCache(message, openaiResult.content, config).catch(console.error)

      return NextResponse.json({
        content: openaiResult.content,
        cached: false,
        userQuery: message,
        latency: openaiResult.latency,
        tokensUsed: openaiResult.tokensUsed,
      })
    }
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong" },
      { status: 500 },
    )
  }
}
