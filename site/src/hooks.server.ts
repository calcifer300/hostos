import type { Handle } from '@sveltejs/kit';

/** One canonical host: www redirects to the apex before anything renders. */
export const handle: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host') ?? '';
	if (host.startsWith('www.')) {
		return new Response(null, { status: 308, headers: { location: `https://${host.slice(4)}${event.url.pathname}${event.url.search}` } });
	}
	return resolve(event);
};
