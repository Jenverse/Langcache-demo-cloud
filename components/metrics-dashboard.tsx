"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getMetrics, resetMetrics, type MetricsData } from "@/lib/metrics"
import { BarChart3, Clock, DollarSign, Target, Zap, RotateCcw, Search } from "lucide-react"

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)

  const refreshMetrics = () => {
    setMetrics(getMetrics())
  }

  const handleReset = () => {
    resetMetrics()
    refreshMetrics()
  }

  useEffect(() => {
    refreshMetrics()
    const interval = setInterval(refreshMetrics, 1000) // Refresh every second
    return () => clearInterval(interval)
  }, [])

  if (!metrics) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Performance Metrics</h2>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cache Hit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cacheHitRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.cacheHits} hits / {metrics.totalRequests} total
            </p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{metrics.cacheHits} hits</Badge>
              <Badge variant="outline">{metrics.cacheMisses} misses</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Token Savings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token Savings</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalTokensSaved.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">vs {metrics.totalTokensUsed.toLocaleString()} used</p>
            <div className="text-sm text-green-600 mt-1">
              {((metrics.totalTokensSaved / (metrics.totalTokensSaved + metrics.totalTokensUsed)) * 100 || 0).toFixed(
                1,
              )}
              % reduction
            </div>
          </CardContent>
        </Card>

        {/* Cost Savings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${metrics.totalCostSaved.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">vs ${metrics.totalCostSpent.toFixed(4)} spent</p>
            <div className="text-sm text-muted-foreground mt-1">Based on $10/1M tokens</div>
          </CardContent>
        </Card>

        {/* LangCache Latency */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LangCache Latency</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.averageLangcacheLatency.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">Average cache response time</p>
            <Badge variant="secondary" className="mt-2">
              {metrics.langcacheLatencies.length} samples
            </Badge>
          </CardContent>
        </Card>

        {/* OpenAI Latency */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OpenAI Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageOpenaiLatency.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">Average API response time</p>
            <Badge variant="secondary" className="mt-2">
              {metrics.openaiLatencies.length} samples
            </Badge>
          </CardContent>
        </Card>

        {/* Speed Improvement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Speed Improvement</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics.averageOpenaiLatency > 0 && metrics.averageLangcacheLatency > 0
                ? `${(((metrics.averageOpenaiLatency - metrics.averageLangcacheLatency) / metrics.averageOpenaiLatency) * 100).toFixed(1)}%`
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Faster with cache</p>
            <div className="text-sm text-muted-foreground mt-1">
              {metrics.averageOpenaiLatency > metrics.averageLangcacheLatency
                ? `${(metrics.averageOpenaiLatency - metrics.averageLangcacheLatency).toFixed(0)}ms saved`
                : "No improvement yet"}
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics.queryRecords && metrics.queryRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Query Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Query</TableHead>
                  <TableHead>Cached Query</TableHead>
                  <TableHead>Similarity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.queryRecords
                  .slice(-20) // Show last 20 queries
                  .reverse() // Show newest first
                  .map((record, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-[200px] truncate" title={record.userQuery}>
                        {record.userQuery}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={record.cachedQuery || "N/A"}>
                        {record.cachedQuery || "N/A"}
                      </TableCell>
                      <TableCell>
                        {record.similarity ? (
                          <Badge variant={record.similarity > 0.8 ? "default" : "secondary"}>
                            {Math.round(record.similarity * 100)}%
                          </Badge>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.cacheHit ? "default" : "outline"}>
                          {record.cacheHit ? "Hit" : "Miss"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
