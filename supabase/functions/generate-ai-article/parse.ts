/**
 * Pure helpers for generate-ai-article (extracted from index.ts for unit
 * testing; the handler itself imports Supabase + does network calls to the
 * Claude API, which the test sandbox blocks). These cover the response parsing
 * and derived-field logic that shape the article that gets saved.
 */

/** Throws if the AI provider API key is not configured. */
export function assertApiKeyConfigured(key: string | undefined | null): void {
  if (!key) {
    throw new Error('CLAUDE_API_KEY not configured');
  }
}

/**
 * Parse the model's response into an article object, tolerating a ```json
 * fenced block or a bare JSON object embedded in surrounding prose. Throws a
 * clear error if no valid JSON can be extracted.
 */
export function parseAiArticleJson(aiContent: string): Record<string, unknown> {
  try {
    const jsonMatch =
      aiContent.match(/```json\n([\s\S]*?)\n```/) || aiContent.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
    return JSON.parse(jsonStr);
  } catch {
    throw new Error('Failed to parse AI-generated content');
  }
}

/** Build a URL-friendly slug from a title (lowercase, hyphenated, capped). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/** Estimate reading time at ~200 words per minute. */
export function calculateReadTime(content: string): string {
  const wordCount = content.split(/\s+/).length;
  return `${Math.ceil(wordCount / 200)} min read`;
}
