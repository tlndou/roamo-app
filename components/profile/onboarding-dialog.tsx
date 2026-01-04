"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, X, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { profileSchema, type ProfileFormData } from "@/lib/validations/profile"
import { checkUsernameAvailable, updateProfile } from "@/lib/api/profiles"
import { useAuth } from "@/components/providers/auth-provider"
import { toast } from "sonner"

export function OnboardingDialog() {
  const { user, profile, refreshProfile } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      username: "",
      bio: "",
    },
  })

  const username = watch("username")

  // Show dialog if user is logged in but hasn't set username
  useEffect(() => {
    if (profile && !profile.username) {
      setIsOpen(true)
    }
  }, [profile])

  // Check username availability with debounce
  useEffect(() => {
    if (!username) {
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
  }, [username, user?.id])

  const onSubmit = async (data: ProfileFormData) => {
    if (!user || !profile) return

    if (usernameAvailable === false) {
      toast.error("Username is already taken")
      return
    }

    try {
      setIsSubmitting(true)

      await updateProfile(user.id, {
        displayName: data.displayName,
        username: data.username,
        bio: data.bio || null,
      })

      await refreshProfile()
      setIsOpen(false)
      toast.success("Welcome to Roamo!")
    } catch (error: any) {
      console.error("Error setting up profile:", error)
      if (error.message?.includes("username")) {
        toast.error("Username is already taken")
      } else {
        toast.error("Failed to set up profile")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Roamo!</DialogTitle>
          <DialogDescription>
            Let's set up your profile to get started. Choose a unique username and display name.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">
              Display Name <span className="text-destructive">*</span>
            </Label>
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
            <Label htmlFor="username">
              Username <span className="text-destructive">*</span>
            </Label>
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
                ) : username ? (
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
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and underscores only. 3-20 characters.
            </p>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isSubmitting || usernameAvailable === false}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              "Get Started"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
