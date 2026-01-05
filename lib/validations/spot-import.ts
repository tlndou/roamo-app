import { z } from "zod"

export const spotImportRequestSchema = z.object({
  url: z.string().url(),
  // Optional context for AI enrichment (e.g., "Trip to London in March, love cozy cafes").
  context: z.string().max(2000).optional(),
})

export type SpotImportRequest = z.infer<typeof spotImportRequestSchema>


