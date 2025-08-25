"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Send, Loader2, Zap, DollarSign, Search, BookOpen } from "lucide-react"
import { updateMetrics } from "@/lib/metrics"

interface Config {
  openaiKey: string
  langcacheUrl: string
  cacheId: string
  serviceKey: string
  shadowMode: boolean
  ragEnabled: boolean
  redisVectorUrl: string
  redisVectorPassword: string
}

interface Message {
  id: string
  content: string
  isUser: boolean
  cached?: boolean
  similarity?: number
  matchedQuery?: string
  latency?: number
  tokensSaved?: number
  tokensUsed?: number
  ragHit?: boolean
  ragSources?: Array<{
    documentId: string
    score: number
    content: string
  }>
}

interface ChatInterfaceProps {
  config: Config
}

export function ChatInterface({ config }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      isUser: true,
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input.trim()
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentInput,
          config: config,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      updateMetrics({
        cached: result.cached || false,
        latency: result.latency || 0,
        tokensSaved: result.tokensSaved,
        tokensUsed: result.tokensUsed,
        userQuery: result.userQuery,
        cachedQuery: result.cachedQuery,
        similarity: result.similarity,
        cacheHit: result.cacheHit, // For shadow mode tracking
        ragHit: result.ragHit,
        ragSources: result.ragSources,
      })

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: result.content,
        isUser: false,
        cached: result.cached,
        similarity: result.similarity,
        latency: result.latency,
        tokensUsed: result.tokensUsed,
        tokensSaved: result.tokensSaved,
        ragHit: result.ragHit,
        ragSources: result.ragSources,
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
        isUser: false,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const placeholderText = config.shadowMode
    ? "Responses will always be served from your LLM but LangCache will record all the data for your analysis on cache hit or miss"
    : config.ragEnabled
      ? "Start a conversation! Your messages will be cached and enhanced with knowledge from your documents."
      : "Start a conversation! Your messages will be cached for faster future responses."

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p>{placeholderText}</p>
            <div className="flex justify-center gap-2 mt-2">
              {config.shadowMode && <Badge variant="outline">Shadow Mode Active</Badge>}
              {config.ragEnabled && <Badge variant="outline">RAG Enabled</Badge>}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
            <Card className={`max-w-[80%] ${message.isUser ? "bg-primary text-primary-foreground" : ""}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {!message.isUser && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {message.cached !== undefined && (
                          <>
                            {message.cached ? (
                              <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700 text-white">
                                🎯 SERVED FROM CACHE - {Math.round((message.similarity || 0) * 100)}% match
                              </Badge>
                            ) : (
                              <Badge variant="default" className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
                                🧠 FRESH from OpenAI
                              </Badge>
                            )}
                          </>
                        )}

                        {message.ragHit !== undefined && (
                          <Badge variant={message.ragHit ? "default" : "outline"} className="text-xs">
                            <BookOpen className="h-3 w-3 mr-1" />
                            {message.ragHit ? "Context Found" : "No Context"}
                          </Badge>
                        )}
                      </div>

                      {message.ragSources && message.ragSources.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium">Knowledge Sources:</div>
                          {message.ragSources.map((source, index) => (
                            <div key={index} className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs">
                                  Doc {source.documentId.slice(0, 8)}...
                                </Badge>
                                <span className="text-green-600">{Math.round(source.score * 100)}% match</span>
                              </div>
                              <div className="truncate">{source.content}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {(message.latency || message.tokensSaved || message.tokensUsed) && (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {message.latency !== undefined && (
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {message.cached ? "Cache" : "LLM"}: {message.latency}ms
                            </div>
                          )}
                          {message.tokensSaved && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Tokens saved: {message.tokensSaved}
                            </div>
                          )}
                          {message.tokensUsed && (
                            <div className="flex items-center gap-1">📊 Used {message.tokensUsed} tokens</div>
                          )}
                        </div>
                      )}

                      {message.matchedQuery && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Search className="h-3 w-3" />
                          Similar to: "{message.matchedQuery}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <Card className="max-w-[80%]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
