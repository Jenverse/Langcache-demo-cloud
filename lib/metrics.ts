export interface QueryRecord {
  userQuery: string
  cachedQuery?: string
  similarity?: number
  timestamp: number
  cacheHit: boolean
  ragHit?: boolean
  ragSources?: Array<{
    documentId: string
    score: number
    content: string
  }>
}

export interface MetricsData {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  ragHits: number
  ragMisses: number
  totalTokensSaved: number
  totalTokensUsed: number
  totalCostSaved: number
  totalCostSpent: number
  langcacheLatencies: number[]
  openaiLatencies: number[]
  averageLangcacheLatency: number
  averageOpenaiLatency: number
  cacheHitRate: number
  ragHitRate: number
  queryRecords: QueryRecord[]
}

const METRICS_KEY = "langcache-metrics"
const TOKEN_COST_PER_MILLION = 10

export function getMetrics(): MetricsData {
  if (typeof window === "undefined") {
    return getDefaultMetrics()
  }

  const stored = localStorage.getItem(METRICS_KEY)
  if (!stored) {
    return getDefaultMetrics()
  }

  try {
    const data = JSON.parse(stored)
    return {
      ...data,
      queryRecords: data.queryRecords || [], // Ensure queryRecords exists
      cacheHitRate: data.totalRequests > 0 ? (data.cacheHits / data.totalRequests) * 100 : 0,
      ragHitRate: data.totalRequests > 0 ? (data.ragHits / data.totalRequests) * 100 : 0,
      averageLangcacheLatency:
        data.langcacheLatencies.length > 0
          ? data.langcacheLatencies.reduce((a: number, b: number) => a + b, 0) / data.langcacheLatencies.length
          : 0,
      averageOpenaiLatency:
        data.openaiLatencies.length > 0
          ? data.openaiLatencies.reduce((a: number, b: number) => a + b, 0) / data.openaiLatencies.length
          : 0,
    }
  } catch {
    return getDefaultMetrics()
  }
}

function getDefaultMetrics(): MetricsData {
  return {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    ragHits: 0,
    ragMisses: 0,
    totalTokensSaved: 0,
    totalTokensUsed: 0,
    totalCostSaved: 0,
    totalCostSpent: 0,
    langcacheLatencies: [],
    openaiLatencies: [],
    averageLangcacheLatency: 0,
    averageOpenaiLatency: 0,
    cacheHitRate: 0,
    ragHitRate: 0,
    queryRecords: [],
  }
}

export function updateMetrics(update: {
  cached: boolean
  latency: number
  tokensSaved?: number
  tokensUsed?: number
  userQuery?: string
  cachedQuery?: string
  similarity?: number
  cacheHit?: boolean // For shadow mode
  ragHit?: boolean
  ragSources?: Array<{
    documentId: string
    score: number
    content: string
  }>
}) {
  if (typeof window === "undefined") return

  const current = getMetrics()

  const tokensSaved = update.tokensSaved || 0
  const tokensUsed = update.tokensUsed || 0
  const actualCacheHit = update.cacheHit !== undefined ? update.cacheHit : update.cached
  const ragHit = update.ragHit || false

  const queryRecord: QueryRecord | null = update.userQuery
    ? {
        userQuery: update.userQuery,
        cachedQuery: update.cachedQuery,
        similarity: update.similarity,
        timestamp: Date.now(),
        cacheHit: actualCacheHit,
        ragHit: ragHit,
        ragSources: update.ragSources,
      }
    : null

  const newMetrics: MetricsData = {
    totalRequests: current.totalRequests + 1,
    cacheHits: current.cacheHits + (actualCacheHit ? 1 : 0),
    cacheMisses: current.cacheMisses + (actualCacheHit ? 0 : 1),
    ragHits: current.ragHits + (ragHit ? 1 : 0),
    ragMisses: current.ragMisses + (ragHit ? 0 : 1),
    totalTokensSaved: current.totalTokensSaved + tokensSaved,
    totalTokensUsed: current.totalTokensUsed + tokensUsed,
    totalCostSaved: current.totalCostSaved + (tokensSaved * TOKEN_COST_PER_MILLION) / 1_000_000,
    totalCostSpent: current.totalCostSpent + (tokensUsed * TOKEN_COST_PER_MILLION) / 1_000_000,
    langcacheLatencies: actualCacheHit
      ? [...current.langcacheLatencies, update.latency].slice(-100)
      : current.langcacheLatencies,
    openaiLatencies: !actualCacheHit
      ? [...current.openaiLatencies, update.latency].slice(-100)
      : current.openaiLatencies,
    averageLangcacheLatency: 0,
    averageOpenaiLatency: 0,
    cacheHitRate: 0,
    ragHitRate: 0,
    queryRecords: queryRecord ? [...current.queryRecords, queryRecord].slice(-100) : current.queryRecords,
  }

  newMetrics.ragHitRate = newMetrics.totalRequests > 0 ? (newMetrics.ragHits / newMetrics.totalRequests) * 100 : 0

  localStorage.setItem(METRICS_KEY, JSON.stringify(newMetrics))
}

export function resetMetrics() {
  if (typeof window === "undefined") return
  localStorage.removeItem(METRICS_KEY)
}
