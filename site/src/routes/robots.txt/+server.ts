import { SITE } from '$lib/content/site';
export const prerender = true;

// Search and AI crawlers are welcome: being quoted by an assistant is how a VA agency gets found now.
// The product itself (/app, /api, /login) is private and has nothing to index.
const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'DuckDuckBot', 'CCBot'];
const PRIVATE = ['/app', '/api/', '/login', '/cocruisers', '/pulse'];
const rules = `Allow: /\n${PRIVATE.map((p) => `Disallow: ${p}`).join('\n')}`;

export const GET = () =>
	new Response(`User-agent: *\n${rules}\n\n${AI_CRAWLERS.map((b) => `User-agent: ${b}\n${rules}`).join('\n\n')}\n\nSitemap: ${SITE.url}/sitemap.xml\n`, {
		headers: { 'content-type': 'text/plain' }
	});
