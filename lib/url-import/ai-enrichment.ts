import { SpotDraft, ExtractionMetadata } from "@/types/url-import"
import { SpotCategory } from "@/types/spot"
import Anthropic from "@anthropic-ai/sdk"

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface EnrichmentResult {
  cleanedName?: string
  inferredCategory?: SpotCategory
  summary?: string
}

export async function enrichSpotDraft(
  draft: SpotDraft,
  meta: ExtractionMetadata
): Promise<SpotDraft> {
  // Only enrich if we have low confidence in category or messy title
  const needsEnrichment =
    meta.confidence.category === "low" ||
    draft.name.length > 100 ||
    draft.name.includes("http") ||
    draft.name.includes("www") ||
    /[^\w\s\-',&.]/.test(draft.name) // Contains unusual characters

  if (!needsEnrichment || !ANTHROPIC_API_KEY) {
    return draft
  }

  try {
    const enriched = await callClaudeAPI({
      name: draft.name,
      description: draft.comments,
      existingCategory: draft.category,
      url: meta.rawUrl,
    })

    return {
      ...draft,
      name: enriched.cleanedName || draft.name,
      category: enriched.inferredCategory || draft.category,
      comments: enriched.summary || draft.comments,
    }
  } catch (error) {
    console.error("AI enrichment failed:", error)
    // Return original draft if enrichment fails
    return draft
  }
}

async function callClaudeAPI(input: {
  name: string
  description?: string
  existingCategory: string
  url: string
}): Promise<EnrichmentResult> {
  const client = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  })

  const prompt = `You are helping clean and enhance spot data extracted from a URL. Your task is to:

1. Clean the title (remove URLs, excess punctuation, promotional language, emojis)
2. Infer the most appropriate category
3. Generate a brief summary if description is messy or missing

CRITICAL RULES:
- DO NOT invent addresses, coordinates, or location details
- DO NOT add information that wasn't in the original data
- Only clean/simplify what's already there
- If you're uncertain, keep the original

Input:
- URL: ${input.url}
- Name: ${input.name}
- Description: ${input.description || "None"}
- Current category: ${input.existingCategory}

Valid categories: restaurant, cafe, bar, museum, park, attraction, activity, event, club, hotel, shop, other

Respond in JSON format with:
{
  "cleanedName": "cleaned title (remove URLs, emojis, excess punctuation)",
  "inferredCategory": "one of the valid categories above",
  "summary": "brief 1-sentence description (only if original is messy or missing)"
}

If the data is already clean, you can omit fields or return the original values.`

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 500,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  })

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : ""

  // Extract JSON from response (handle markdown code blocks)
  let jsonText = responseText.trim()
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```\n?$/, "")
  }

  const result = JSON.parse(jsonText)

  return {
    cleanedName: result.cleanedName,
    inferredCategory: result.inferredCategory,
    summary: result.summary,
  }
}
