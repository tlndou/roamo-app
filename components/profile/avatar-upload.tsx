"use client"

import { useState, useRef } from "react"
import { Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface AvatarUploadProps {
  currentAvatarUrl?: string | null
  onImageSelect: (file: File) => void
  onRemove: () => void
  displayName?: string
}

export function AvatarUpload({ currentAvatarUrl, onImageSelect, onRemove, displayName }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be less than 2MB")
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    onImageSelect(file)
  }

  const handleRemove = () => {
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onRemove()
  }

  const avatarSrc = preview || currentAvatarUrl || undefined
  const initials = displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <Avatar className="h-24 w-24">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt={displayName || "Avatar"} /> : <AvatarFallback className="text-2xl">{initials}</AvatarFallback>}
        </Avatar>
        {avatarSrc && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-md transition-all hover:scale-110"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="avatar-upload"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" />
          {avatarSrc ? "Change Photo" : "Upload Photo"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">JPG, PNG or WEBP. Max 2MB.</p>
      </div>
    </div>
  )
}
