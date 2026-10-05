import { SITE } from '$lib/content/site';
import { SERVICES } from '$lib/content/pricing';
export const prerender = true;
const pages: [path: string, priority: string][] = [['/', '1.0'], ['/team', '0.7'], ['/team/pricing', '0.7'], ['/about', '0.6'], ['/services', '0.9'], ...SERVICES.map((s): [string, string] => [`/services/${s.id}`, '0.8'])];
// the build date: the home page is regenerated from the Founder's saved copy, so "modified" is honest at build time
const lastmod = new Date().toISOString().slice(0, 10);
export const GET = () =>
	new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p, pr]) => `  <url><loc>${SITE.url}${p === '/' ? '/' : p}</loc><lastmod>${lastmod}</lastmod><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml' } }
	);
