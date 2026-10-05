import { llmsIndex } from '$lib/seo/llms';
export const prerender = true;
export const GET = () => new Response(llmsIndex(), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
