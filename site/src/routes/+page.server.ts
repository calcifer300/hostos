import { env } from '$env/dynamic/private';
import { loadLanding } from '$lib/content/remote';
import type { PageServerLoad } from './$types';

/**
 * Not prerendered: regenerated on Vercel every five minutes (ISR) with
 * whatever the Founder last saved in the app — the roster, the hero clip,
 * the four chapters. The first visitor after a change waits on nothing;
 * the next one gets the fresh page.
 */
export const prerender = false;
export const config = { isr: { expiration: 300 } };

// NO_REMOTE=1 (the local Lighthouse harness) measures the page itself, not the round trip to the app.
export const load: PageServerLoad = async ({ fetch }) => loadLanding(env.NO_REMOTE ? async () => new Response(null, { status: 503 }) : fetch);
