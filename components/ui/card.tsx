import type * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("leading-none font-semibold", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-muted-foreground text-sm", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center px-6 [.border-t]:pt-6", className)} {...props} />
}

function CardStatusBar({
  status,
  progress,
  chunkCount,
  className,
  ...props
}: {
  status: "idle" | "extracting" | "chunking" | "embedding" | "storing" | "ready" | "error"
  progress?: number
  chunkCount?: number
  className?: string
} & React.ComponentProps<"div">) {
  const getStatusInfo = () => {
    switch (status) {
      case "extracting":
        return { icon: "📄", text: "Extracting text from document...", color: "text-blue-600" }
      case "chunking":
        return { icon: "✂️", text: "Creating text chunks...", color: "text-orange-600" }
      case "embedding":
        return { icon: "🧠", text: "Generating embeddings...", color: "text-purple-600" }
      case "storing":
        return { icon: "💾", text: "Storing vectors in Redis...", color: "text-green-600" }
      case "ready":
        return { icon: "✅", text: `Ready - ${chunkCount} chunks created`, color: "text-green-700" }
      case "error":
        return { icon: "❌", text: "Processing failed", color: "text-red-600" }
      default:
        return { icon: "⏳", text: "Waiting to process...", color: "text-gray-500" }
    }
  }

  const statusInfo = getStatusInfo()
  const isProcessing = ["extracting", "chunking", "embedding", "storing"].includes(status)

  return (
    <div
      data-slot="card-status-bar"
      className={cn("px-6 py-3 border-t bg-muted/30 rounded-b-xl", className)}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusInfo.icon}</span>
          <span className={cn("text-sm font-medium", statusInfo.color)}>{statusInfo.text}</span>
          {isProcessing && (
            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full opacity-60" />
          )}
        </div>

        {progress !== undefined && isProcessing && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-current transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
        )}

        {status === "ready" && chunkCount && (
          <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
            {chunkCount} chunks
          </div>
        )}
      </div>
    </div>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardStatusBar, // Added CardStatusBar to exports
}
