"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { Switch } from "@/components/ui/switch"

interface Config {
  openaiKey: string
  langcacheUrl: string
  cacheId: string
  serviceKey: string
  shadowMode: boolean
}

interface ConfigurationFormProps {
  onSave: (config: Config) => void
  initialConfig?: Config | null
}

export function ConfigurationForm({ onSave, initialConfig }: ConfigurationFormProps) {
  const [config, setConfig] = useState<Config>({
    openaiKey: initialConfig?.openaiKey || "",
    langcacheUrl: initialConfig?.langcacheUrl || "",
    cacheId: initialConfig?.cacheId || "",
    serviceKey: initialConfig?.serviceKey || "",
    shadowMode: initialConfig?.shadowMode || false,
  })
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<{
    openai?: boolean
    langcache?: boolean
    error?: string
  }>({})

  const testConnections = async () => {
    setTesting(true)
    setTestResults({})

    try {
      const response = await fetch("/api/test-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })

      const results = await response.json()
      setTestResults(results)
    } catch (error) {
      setTestResults({ error: "Failed to test connections" })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!config.openaiKey || !config.langcacheUrl || !config.cacheId || !config.serviceKey) {
      setTestResults({ error: "Please fill in all fields" })
      return
    }
    onSave(config)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="openaiKey">OpenAI API Key</Label>
          <Input
            id="openaiKey"
            type="password"
            placeholder="sk-proj-..."
            value={config.openaiKey}
            onChange={(e) => setConfig({ ...config, openaiKey: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="langcacheUrl">LangCache Service URL</Label>
          <Input
            id="langcacheUrl"
            placeholder="https://gcp-us-east4.langcache.redis.io"
            value={config.langcacheUrl}
            onChange={(e) => setConfig({ ...config, langcacheUrl: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cacheId">LangCache Cache ID</Label>
          <Input
            id="cacheId"
            placeholder="bb79862f2eeb4036a0a18b3a99a679ca"
            value={config.cacheId}
            onChange={(e) => setConfig({ ...config, cacheId: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="serviceKey">LangCache Service Key</Label>
          <Input
            id="serviceKey"
            type="password"
            placeholder="Your LangCache API key"
            value={config.serviceKey}
            onChange={(e) => setConfig({ ...config, serviceKey: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between space-y-2">
          <div className="space-y-1">
            <Label htmlFor="shadowMode">Shadow Mode</Label>
            <p className="text-sm text-muted-foreground">
              Always serve responses from OpenAI while recording LangCache metrics for analysis
            </p>
          </div>
          <Switch
            id="shadowMode"
            checked={config.shadowMode}
            onCheckedChange={(checked) => setConfig({ ...config, shadowMode: checked })}
          />
        </div>
      </div>

      {testResults.error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{testResults.error}</AlertDescription>
        </Alert>
      )}

      {(testResults.openai !== undefined || testResults.langcache !== undefined) && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {testResults.openai ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>OpenAI Connection</span>
              </div>
              <div className="flex items-center gap-2">
                {testResults.langcache ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>LangCache Connection</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={testConnections} disabled={testing} variant="outline">
          {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Test Connections
        </Button>
        <Button onClick={handleSave} className="flex-1">
          Save Configuration
        </Button>
      </div>
    </div>
  )
}
