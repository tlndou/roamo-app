"use client"

import type React from "react"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Spot } from "@/types/spot"

interface QuickAddFormProps {
  onSubmit: (spot: Spot) => void
}

export function QuickAddForm({ onSubmit }: QuickAddFormProps) {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate API call to extract info from social media link
    // In production, this would call an API route that uses AI to extract spot details
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock extracted data
    onSubmit({
      id: Date.now().toString(),
      category: "restaurant",
      name: "Extracted Restaurant",
      city: "City Name",
      country: "Country Name",
      continent: "Europe",
      coordinates: { lat: 0, lng: 0 },
      comments: "Auto-extracted from link",
      thumbnail: "",
      link: url,
    })

    setIsLoading(false)
    setUrl("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          Paste a link from Instagram, TikTok, or other social media and we'll automatically extract the spot details.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">Social Media Link</Label>
        <Input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://instagram.com/reel/..."
          required
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Extracting...
          </>
        ) : (
          "Extract & Add"
        )}
      </Button>
    </form>
  )
}
