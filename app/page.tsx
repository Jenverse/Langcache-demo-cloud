"use client"

import { useState, useEffect } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { ConfigurationForm } from "@/components/configuration-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, BarChart3 } from "lucide-react"
import Link from "next/link"

interface Config {
  openaiKey: string
  langcacheUrl: string
  cacheId: string
  serviceKey: string
  shadowMode: boolean
  ragEnabled: boolean
  redisVectorUrl: string
  redisVectorPassword: string
  documents: Array<{
    id: string
    name: string
    url: string
    status: "pending" | "processing" | "ready" | "error"
  }>
}

export default function Home() {
  const [config, setConfig] = useState<Config | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    const savedConfig = localStorage.getItem("langcache-config")
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig))
    } else {
      setShowConfig(true)
    }
  }, [])

  const handleConfigSave = (newConfig: Config) => {
    setConfig(newConfig)
    localStorage.setItem("langcache-config", JSON.stringify(newConfig))
    setShowConfig(false)
  }

  const handleConfigEdit = () => {
    setShowConfig(true)
  }

  if (showConfig || !config) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                LangCache Configuration
              </CardTitle>
              <CardDescription>Configure your OpenAI and LangCache credentials to start chatting</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigurationForm onSave={handleConfigSave} initialConfig={config} />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h1 className="text-2xl font-bold">LangCache Chatbot</h1>
            <p className="text-muted-foreground">Semantic caching for faster responses</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/metrics">
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Metrics
              </Button>
            </Link>
            <Button variant="outline" onClick={handleConfigEdit}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
        <div className="p-4">
          <ChatInterface config={config} />
        </div>
      </div>
    </div>
  )
}
