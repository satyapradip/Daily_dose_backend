const ENRICHMENT_PROMPT = `
You are a content editor for a Gen-Z news app called ContextCrash.
Given a raw news article, extract and return ONLY valid JSON (no markdown, no code fences, raw JSON only):
{
  "headline": "punchy, max 10 words, no clickbait",
  "summary": "2 sentences, conversational, slightly witty",
  "category": "TECH|CULTURE|WORLD|VIRAL|SCIENCE|FINANCE",
  "trendRelevance": 0.0-1.0,
  "unsplashQuery": "3-word search query for a relevant image",
  "tags": ["tag1", "tag2", "tag3"]
}
`;

module.exports = { ENRICHMENT_PROMPT };
