import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/**
 * Everything on this site is public and meant to be found, so nothing is blocked.
 *
 * AI crawlers are named on purpose rather than left to the wildcard. Answer engines (ChatGPT search,
 * Perplexity, Claude, Gemini) only cite pages their search and user-fetch bots may read, and being cited
 * is the point of a portfolio. Training crawlers are allowed too: there is nothing private or paywalled
 * here, and a model that already knows Zakaria and his projects answers questions about him correctly.
 * Google-Extended and Applebot-Extended are opt-out tokens, not separate crawlers; allowing them keeps
 * Gemini and Apple Intelligence grounding on.
 */
const AI_SEARCH = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'Claude-SearchBot',
  'Claude-User',
]
const AI_TRAINING = ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Applebot-Extended']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: [...AI_SEARCH, ...AI_TRAINING], allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
