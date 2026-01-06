import { z } from "zod"

export const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50, "Display name must be 50 characters or less"),

  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be 20 characters or less")
    .regex(/^[a-z0-9_]+$/, "Username must be lowercase letters, numbers, or underscores"),

  birthdate: z.string().refine(
    (date) => {
      const birthDate = new Date(date)
      const today = new Date()
      return birthDate < today
    },
    { message: "Birthdate must be in the past" }
  ),

  bio: z.string().max(500, "Bio must be 500 characters or less").optional().nullable(),
})

export type ProfileFormData = z.infer<typeof profileSchema>

// Edit Profile form does not include birthdate, so it must not be required here.
export const profileEditSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50, "Display name must be 50 characters or less"),

  bio: z.string().max(500, "Bio must be 500 characters or less").optional().nullable(),
})

export type ProfileEditFormData = z.infer<typeof profileEditSchema>
