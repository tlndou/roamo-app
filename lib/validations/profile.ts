import { z } from "zod"

export const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50, "Display name must be 50 characters or less"),

  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be 20 characters or less")
    .regex(/^[a-z0-9_]+$/, "Username must be lowercase letters, numbers, or underscores"),

  bio: z.string().max(500, "Bio must be 500 characters or less").optional().nullable(),
})

export type ProfileFormData = z.infer<typeof profileSchema>
