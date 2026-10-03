import { SITE } from '$lib/content/site';
export const prerender = true;
export const GET = () => new Response(`User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
