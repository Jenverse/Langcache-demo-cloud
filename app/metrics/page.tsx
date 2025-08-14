"use client"

import { MetricsDashboard } from "@/components/metrics-dashboard"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart3 } from "lucide-react"
import Link from "next/link"

export default function MetricsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                LangCache Metrics
              </h1>
              <p className="text-muted-foreground">Performance analytics and cache statistics</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <MetricsDashboard />
        </div>
      </div>
    </div>
  )
}
