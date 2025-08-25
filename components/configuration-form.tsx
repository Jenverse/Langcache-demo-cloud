"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, XCircle, Plus, Trash2, ExternalLink } from "lucide-react"
import { Switch } from "@/components/ui/switch"

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
    status: "pending" | "extracting" | "chunking" | "vectorizing" | "storing" | "ready" | "error"
    chunkCount?: number
    statusMessage?: string
  }>
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
    ragEnabled: initialConfig?.ragEnabled || false,
    redisVectorUrl: initialConfig?.redisVectorUrl || "",
    redisVectorPassword: initialConfig?.redisVectorPassword || "",
    documents: initialConfig?.documents || [],
  })
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<{
    openai?: boolean
    langcache?: boolean
    redis?: boolean
    error?: string
  }>({})
  const [newDocUrl, setNewDocUrl] = useState("")

  const testConnections = async () => {
    setTesting(true)
    setTestResults({})

    try {
      console.log("[v0] Starting connection test with config:", {
        hasOpenaiKey: !!config.openaiKey,
        langcacheUrl: config.langcacheUrl,
        cacheId: config.cacheId,
        hasServiceKey: !!config.serviceKey,
        ragEnabled: config.ragEnabled,
        hasRedisUrl: !!config.redisVectorUrl,
      })

      const response = await fetch("/api/test-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })

      const results = await response.json()
      console.log("[v0] Connection test results:", results)

      if (results.error) {
        setTestResults({ error: `${results.error}: ${results.details || "Unknown error"}` })
      } else if (results.errors && Object.keys(results.errors).length > 0) {
        const errorMessages = Object.entries(results.errors)
          .filter(([_, error]) => error)
          .map(([service, error]) => `${service}: ${error}`)
          .join("; ")
        setTestResults({ ...results, error: errorMessages })
      } else {
        setTestResults(results)
      }
    } catch (error) {
      console.error("[v0] Connection test failed:", error)
      setTestResults({ error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}` })
    } finally {
      setTesting(false)
    }
  }

  const addDocument = async () => {
    if (!newDocUrl.trim()) return

    const newDoc = {
      id: Date.now().toString(),
      name: extractDocName(newDocUrl),
      url: newDocUrl.trim(),
      status: "pending" as const,
    }

    const updatedDocs = [...config.documents, newDoc]
    setConfig({
      ...config,
      documents: updatedDocs,
    })
    setNewDocUrl("")

    processDocument(newDoc.id, newDoc.url, updatedDocs)
  }

  const processDocument = async (docId: string, docUrl: string, currentDocs: typeof config.documents) => {
    const updateDocStatus = (
      status: "pending" | "extracting" | "chunking" | "vectorizing" | "storing" | "ready" | "error",
      message?: string,
      chunkCount?: number,
    ) => {
      setConfig((prev) => ({
        ...prev,
        documents: prev.documents.map((doc) =>
          doc.id === docId ? { ...doc, status, statusMessage: message, chunkCount } : doc,
        ),
      }))
    }

    try {
      updateDocStatus("extracting", "Extracting text from document...")
      console.log("[v0] Starting document processing for:", docUrl)

      const response = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: docUrl, // Changed from documentUrl to url
          documentId: docId,
          openaiKey: config.openaiKey,
        }),
      })

      const result = await response.json()
      console.log("[v0] Document processing result:", result)

      if (result.success) {
        updateDocStatus("ready", `Vectorized & stored ${result.chunksCount} chunks`, result.chunksCount)
        console.log(`[v0] Document processed successfully: ${result.chunksCount} chunks stored`)
      } else {
        updateDocStatus("error", `Processing failed: ${result.error}`)
        console.error("[v0] Document processing failed:", result.error)
      }
    } catch (error) {
      updateDocStatus("error", `Network error: ${error instanceof Error ? error.message : "Unknown error"}`)
      console.error("[v0] Document processing error:", error)
    }
  }

  const removeDocument = (id: string) => {
    setConfig({
      ...config,
      documents: config.documents.filter((doc) => doc.id !== id),
    })
  }

  const extractDocName = (url: string) => {
    try {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
      return match ? `Google Doc ${match[1].slice(0, 8)}...` : "Unknown Document"
    } catch {
      return "Unknown Document"
    }
  }

  const handleSave = () => {
    const requiredFields = [config.openaiKey, config.langcacheUrl, config.cacheId, config.serviceKey]
    const ragRequiredFields = config.ragEnabled ? [config.redisVectorUrl, config.redisVectorPassword] : []

    if (!requiredFields.every((field) => field) || !ragRequiredFields.every((field) => field)) {
      setTestResults({ error: "Please fill in all required fields" })
      return
    }
    onSave(config)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="openaiKey">OpenAI API Key</Label>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Get API Key
            </a>
          </div>
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

        <div className="flex items-center justify-between space-y-2">
          <div className="space-y-1">
            <Label htmlFor="ragEnabled">RAG-Context Enabled</Label>
            <p className="text-sm text-muted-foreground">
              Enable Retrieval-Augmented Generation using your document knowledge base
            </p>
          </div>
          <Switch
            id="ragEnabled"
            checked={config.ragEnabled}
            onCheckedChange={(checked) => setConfig({ ...config, ragEnabled: checked })}
          />
        </div>

        {config.ragEnabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="redisVectorUrl">Redis Vector Database URL</Label>
              <Input
                id="redisVectorUrl"
                placeholder="redis://default:password@host:port"
                value={config.redisVectorUrl}
                onChange={(e) => setConfig({ ...config, redisVectorUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="redisVectorPassword">Redis Vector Database Password</Label>
              <Input
                id="redisVectorPassword"
                type="password"
                placeholder="Your Redis password"
                value={config.redisVectorPassword}
                onChange={(e) => setConfig({ ...config, redisVectorPassword: e.target.value })}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Document Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://docs.google.com/document/d/..."
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addDocument()}
                  />
                  <Button onClick={addDocument} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {config.documents.length > 0 && (
                  <div className="space-y-2">
                    {config.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {(doc.status === "extracting" ||
                            doc.status === "chunking" ||
                            doc.status === "vectorizing" ||
                            doc.status === "storing") && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                          <div className="flex-1">
                            <p className="font-medium">{doc.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  doc.status === "ready"
                                    ? "bg-green-100 text-green-700"
                                    : (
                                          doc.status === "extracting" ||
                                            doc.status === "chunking" ||
                                            doc.status === "vectorizing" ||
                                            doc.status === "storing"
                                        )
                                      ? "bg-blue-100 text-blue-700"
                                      : doc.status === "error"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {doc.status === "ready"
                                  ? `✅ ${doc.statusMessage || "Ready"}`
                                  : doc.status === "extracting"
                                    ? "📄 Extracting text..."
                                    : doc.status === "chunking"
                                      ? "✂️ Creating chunks..."
                                      : doc.status === "vectorizing"
                                        ? "🧠 Generating embeddings..."
                                        : doc.status === "storing"
                                          ? "💾 Storing in Redis..."
                                          : doc.status === "error"
                                            ? "❌ Failed"
                                            : "⏳ Pending"}
                              </span>
                              {doc.chunkCount && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                  {doc.chunkCount} chunks
                                </span>
                              )}
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-blue-600"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View
                              </a>
                            </div>
                            {doc.statusMessage && doc.status !== "ready" && (
                              <p className="text-xs text-muted-foreground mt-1">{doc.statusMessage}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => removeDocument(doc.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {testResults.error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{testResults.error}</AlertDescription>
        </Alert>
      )}

      {(testResults.openai !== undefined || testResults.langcache !== undefined || testResults.redis !== undefined) && (
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
              {config.ragEnabled && (
                <div className="flex items-center gap-2">
                  {testResults.redis ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Redis Vector Database Connection</span>
                </div>
              )}
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
