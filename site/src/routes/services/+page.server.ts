import { env } from '$env/dynamic/private';
import { loadLanding } from '$lib/content/remote';
import type { PageServerLoad } from './$types';

// Same as the home page: regenerated every five minutes with whatever the Founder last saved, so a changed price shows up here too.
export const prerender = false;
export const config = { isr: { expiration: 300 } };

export const load: PageServerLoad = async ({ fetch }) => ({ services: (await loadLanding(env.NO_REMOTE ? async () => new Response(null, { status: 503 }) : fetch)).services });
