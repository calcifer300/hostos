import { normalizeTeam, TEAM } from '$lib/content/team';
import { SITE } from '$lib/content/site';
import type { PageLoad } from './$types';

/**
 * The roster comes from the app (the Founder edits it there). At build the
 * page is prerendered with whatever the app answers; if it does not answer,
 * the built-in roster stands in. Never a failed build over a roster.
 */
export const load: PageLoad = async ({ fetch }) => {
	try {
		const r = await fetch(`${SITE.url}/api/public/team`, { headers: { accept: 'application/json' } });
		if (!r.ok) return { members: TEAM };
		return { members: normalizeTeam(await r.json()) };
	} catch {
		return { members: TEAM };
	}
};
