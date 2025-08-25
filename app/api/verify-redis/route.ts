import { type NextRequest, NextResponse } from "next/server"
import Redis from "ioredis"

export async function POST(request: NextRequest) {
  try {
    const { redisVectorUrl, redisVectorPassword } = await request.json()

    if (!redisVectorUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Redis URL is required",
        },
        { status: 400 },
      )
    }

    console.log("[v0] Testing Redis connection to:", redisVectorUrl.replace(/\/\/.*@/, "//***@"))

    const redis = new Redis(redisVectorUrl, {
      password: redisVectorPassword,
      connectTimeout: 10000,
      lazyConnect: true,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    })

    const startTime = Date.now()

    try {
      await redis.ping()
      const latency = Date.now() - startTime

      // Test basic operations
      await redis.set("test:connection", "verified", "EX", 10)
      const testValue = await redis.get("test:connection")
      await redis.del("test:connection")

      // Get Redis info
      const info = await redis.info("server")
      const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1] || "unknown"

      await redis.disconnect()

      console.log("[v0] Redis connection successful - Latency:", latency + "ms", "Version:", redisVersion)

      return NextResponse.json({
        success: true,
        latency,
        redisVersion,
        testOperations: {
          ping: true,
          set: true,
          get: testValue === "verified",
          delete: true,
        },
        message: `Successfully connected to Redis v${redisVersion} (${latency}ms latency)`,
      })
    } catch (connectionError) {
      await redis.disconnect()
      console.error("[v0] Redis connection failed:", connectionError)

      return NextResponse.json({
        success: false,
        error: connectionError instanceof Error ? connectionError.message : "Connection failed",
        details: {
          url: redisVectorUrl.replace(/\/\/.*@/, "//***@"),
          timeout: "10000ms",
          retries: 3,
        },
      })
    }
  } catch (error) {
    console.error("[v0] Redis verification error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to verify Redis connection",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
