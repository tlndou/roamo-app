"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, X, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AvatarUpload } from "./avatar-upload"
import { profileEditSchema, type ProfileEditFormData } from "@/lib/validations/profile"
import { checkUsernameAvailable, updateProfile, uploadAvatar } from "@/lib/api/profiles"
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
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)

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
      username: profile.username || "",
      bio: profile.bio || "",
    },
  })

  const username = watch("username")

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username === profile.username) {
      setUsernameAvailable(null)
      return
    }

    setIsCheckingUsername(true)
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username, user?.id)
        setUsernameAvailable(available)
      } catch (error) {
        console.error("Error checking username:", error)
      } finally {
        setIsCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username, profile.username, user?.id])

  const onSubmit = async (data: ProfileEditFormData) => {
    if (!user) return

    // Check username availability before submitting
    if (data.username !== profile.username && usernameAvailable === false) {
      toast.error("Username is already taken")
      return
    }

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
        username: data.username,
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
      if (error.message?.includes("username")) {
        toast.error("Username is already taken")
      } else {
        toast.error("Failed to update profile")
      }
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
        <div className="relative">
          <Input
            id="username"
            {...register("username")}
            placeholder="johndoe"
            className={errors.username || usernameAvailable === false ? "border-destructive pr-10" : "pr-10"}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isCheckingUsername ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : username && username !== profile.username ? (
              usernameAvailable ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-destructive" />
              )
            ) : null}
          </div>
        </div>
        {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
        {usernameAvailable === false && <p className="text-sm text-destructive">Username is already taken</p>}
        <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only. 3-20 characters.</p>
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
        <Button type="submit" disabled={!(isDirty || avatarDirty) || isSubmitting || usernameAvailable === false}>
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
