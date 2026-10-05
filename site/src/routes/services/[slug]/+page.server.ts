import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { loadLanding } from '$lib/content/remote';
import type { PageServerLoad } from './$types';

// Same as the home page: regenerated every five minutes with whatever the Founder last saved.
export const prerender = false;
export const config = { isr: { expiration: 300 } };

export const load: PageServerLoad = async ({ fetch, params }) => {
	const { services } = await loadLanding(env.NO_REMOTE ? async () => new Response(null, { status: 503 }) : fetch);
	const service = services.find((s) => s.id === params.slug);
	if (!service) error(404, 'No such service');
	return { service, others: services.filter((s) => s.id !== service.id) };
};
