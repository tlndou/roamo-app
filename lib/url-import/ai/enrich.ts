import type { ImportedSpotDraft } from "@/lib/url-import/extract-spot-from-url"
import type { SpotCategory } from "@/types/spot"

export type SpotVibe =
  | "casual"
  | "fine_dining"
  | "romantic"
  | "family_friendly"
  | "trendy"
  | "cozy"
  | "lively"
  | "quiet"
  | "outdoors"
  | "scenic"

type Enrichment = {
  cleanName?: string
  category?: SpotCategory
  vibes?: SpotVibe[]
  summary?: string
}

function toStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined
  const s = v.trim()
  return s.length ? s : undefined
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export async function maybeEnrichWithAI(input: {
  draft: ImportedSpotDraft
  rawText?: string
  originalUrl?: string
  context?: string
}): Promise<{ draft: ImportedSpotDraft; enrichment?: Enrichment }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { draft: input.draft }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini"

  const prompt = {
    instructions:
      [
        "You are cleaning and enriching an imported travel spot.",
        "Return ONLY valid JSON matching the schema. Don't include markdown.",
        "IMPORTANT: Do NOT invent a place name or location. Only clean/shorten the name if it's clearly derived from existing strings (name/url/comments).",
        'For category/vibes/summary you may infer from weak signals (URL text, preview image URL, comments), but if unsure choose "other" and omit vibes.',
      ].join("\n"),
    schema: {
      cleanName: "string (optional)",
      category:
        'one of: "restaurant","cafe","bar","museum","park","attraction","activity","event","club","hotel","shop","other" (optional)',
      vibes:
        'array of: "casual","fine_dining","romantic","family_friendly","trendy","cozy","lively","quiet","outdoors","scenic" (optional)',
      summary: "string, max 280 chars (optional)",
    },
    input: {
      name: input.draft.name,
      category: input.draft.category,
      address: input.draft.address,
      city: input.draft.city,
      country: input.draft.country,
      link: input.draft.link,
      originalUrl: input.originalUrl,
      previewImageUrl: input.draft.customImage,
      context: input.context,
      comments: input.draft.comments,
      rawText: input.rawText,
    },
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only." },
        { role: "user", content: JSON.stringify(prompt) },
      ],
    }),
  })

  if (!res.ok) return { draft: input.draft }
  const data = (await res.json()) as any
  const content = toStr(data?.choices?.[0]?.message?.content)
  if (!content) return { draft: input.draft }

  const parsed = safeJsonParse(content) as Enrichment | undefined
  if (!parsed || typeof parsed !== "object") return { draft: input.draft }

  const updated: ImportedSpotDraft = { ...input.draft }
  if (toStr(parsed.cleanName)) updated.name = parsed.cleanName
  if (parsed.category) updated.category = parsed.category

  // Persist vibes/summary into comments for now (DB schema has only comments).
  const lines: string[] = []
  if (toStr(parsed.summary)) lines.push(`Summary: ${parsed.summary}`)
  if (parsed.vibes?.length) lines.push(`Vibe: ${parsed.vibes.join(", ")}`)
  if (lines.length) {
    updated.comments = [updated.comments, "", ...lines].filter(Boolean).join("\n")
  }

  return { draft: updated, enrichment: parsed }
}


