import { SITE } from '$lib/content/site';
export const prerender = true;
const pages = ['/', '/team', '/team/pricing', '/about'];
export const GET = () =>
	new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${SITE.url}${p}</loc><changefreq>monthly</changefreq></url>`).join('\n')}\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml' } }
	);
