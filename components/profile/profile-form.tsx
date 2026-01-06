"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AvatarUpload } from "./avatar-upload"
import { profileEditSchema, type ProfileEditFormData } from "@/lib/validations/profile"
import { updateProfile, uploadAvatar } from "@/lib/api/profiles"
import { useAuth } from "@/components/providers/auth-provider"
import { toast } from "sonner"
import type { Profile } from "@/types/profile"

interface ProfileFormProps {
  profile: Profile
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const { user, refreshProfile } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarRemoved, setAvatarRemoved] = useState(false)
  const [avatarDirty, setAvatarDirty] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileEditFormData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      displayName: profile.displayName || "",
      bio: profile.bio || "",
    },
  })

  const onSubmit = async (data: ProfileEditFormData) => {
    if (!user) return

    try {
      setIsSubmitting(true)

      let avatarUrl = profile.avatarUrl

      // If user explicitly removed avatar, clear it.
      if (avatarRemoved) {
        avatarUrl = null
      }

      // Upload avatar if new file selected (overrides removal)
      if (avatarFile) {
        avatarUrl = await uploadAvatar(user.id, avatarFile)
      }

      // Update profile
      await updateProfile(user.id, {
        displayName: data.displayName,
        bio: data.bio || undefined,
        avatarUrl,
      })

      // Refresh profile data
      await refreshProfile()

      toast.success("Profile updated successfully")
      reset(data)
      setAvatarFile(null)
      setAvatarRemoved(false)
      setAvatarDirty(false)
      router.push("/profile")
    } catch (error: any) {
      console.error("Error updating profile:", error)
      toast.error("Failed to update profile")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAvatarRemove = () => {
    setAvatarFile(null)
    setAvatarRemoved(true)
    setAvatarDirty(true)
  }

  const charCount = watch("bio")?.length || 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Avatar Upload */}
      <div>
        <Label className="mb-4 block">Profile Photo</Label>
        <AvatarUpload
          currentAvatarUrl={avatarRemoved ? null : profile.avatarUrl}
          onImageSelect={(file) => {
            setAvatarFile(file)
            setAvatarRemoved(false)
            setAvatarDirty(true)
          }}
          onRemove={handleAvatarRemove}
          displayName={profile.displayName || profile.username}
        />
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name *</Label>
        <Input
          id="displayName"
          {...register("displayName")}
          placeholder="John Doe"
          className={errors.displayName ? "border-destructive" : ""}
        />
        {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
      </div>

      {/* Username */}
      <div className="space-y-2">
        <Label htmlFor="username">Username *</Label>
        <Input id="username" value={profile.username || ""} disabled />
        <p className="text-xs text-muted-foreground">
          Usernames can’t be changed once set.
        </p>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" {...register("bio")} placeholder="Tell us about yourself..." rows={4} className={errors.bio ? "border-destructive" : ""} />
        <div className="flex items-center justify-between">
          {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
          <p className="ml-auto text-xs text-muted-foreground">
            {charCount}/500
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-4">
        <Button type="submit" disabled={!(isDirty || avatarDirty) || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset()
            setAvatarFile(null)
            setAvatarRemoved(false)
            setAvatarDirty(false)
            router.push("/profile")
          }}
          disabled={!(isDirty || avatarDirty) || isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
