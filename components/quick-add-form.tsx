"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Spot } from "@/types/spot"
import { URLImportResult } from "@/types/url-import"
import { ConfirmationDialog } from "./confirmation-dialog"
import { toast } from "sonner"

interface QuickAddFormProps {
  onSubmit: (spot: Omit<Spot, "id" | "createdAt">) => void
}

const QUICK_DRAFT_KEY = "roamo:addSpot:quickDraft:v1"

export function QuickAddForm({ onSubmit }: QuickAddFormProps) {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [importResult, setImportResult] = useState<URLImportResult | null>(
    null
  )

  const hydratedRef = useRef(false)

  // Restore URL draft after tab switch / refresh.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(QUICK_DRAFT_KEY)
      if (!raw) {
        hydratedRef.current = true
        return
      }
      const parsed = JSON.parse(raw) as { url?: string }
      if (typeof parsed.url === "string") setUrl(parsed.url)
    } catch {
      // ignore
    } finally {
      hydratedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    try {
      window.sessionStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ url }))
    } catch {
      // ignore
    }
  }, [url])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/spot-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to import URL")
      }

      const result: URLImportResult = await response.json()

      // Show warnings if any
      if (result.meta.warnings.length > 0) {
        result.meta.warnings.forEach((warning) => toast.warning(warning))
      }

      // Always show the confirmation form before creating the spot.
      // Quick Add should never auto-create spots, even on high confidence.
      setImportResult(result)
    } catch (error: any) {
      toast.error(error.message || "Failed to import URL")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = (confirmedDraft: Omit<Spot, "id" | "createdAt">) => {
    onSubmit(confirmedDraft)
    setImportResult(null)
    setUrl("")
    try {
      window.sessionStorage.removeItem(QUICK_DRAFT_KEY)
    } catch {
      // ignore
    }
    toast.success("Spot added successfully")
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            Paste a link from Google Maps, Instagram, TikTok, or any
            restaurant website to automatically extract spot details.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">Paste a link</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://maps.google.com/..."
            required
          />
          <p className="text-xs text-muted-foreground">
            Supports Google Maps and restaurant websites
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            "Import Spot"
          )}
        </Button>
      </form>

      {importResult && (
        <ConfirmationDialog
          result={importResult}
          onConfirm={handleConfirm}
          onCancel={() => setImportResult(null)}
        />
      )}
    </>
  )
}
