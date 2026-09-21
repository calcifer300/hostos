<script lang="ts">
	import { getContext } from 'svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import { stagger, tilt } from '$lib/components/motion/actions';
	import { VOICES } from '$lib/content/site';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	/**
	 * Owners in their own words, under a row of laurels carrying the
	 * company's figures. Both lists are the Founder's to edit in the app;
	 * nothing here is invented for the page.
	 */
	const landing = getContext<Landing | undefined>('landing');
	const testimonials = $derived(landing?.testimonials ?? LANDING_DEFAULTS.testimonials);
	const laurels = $derived(landing?.laurels ?? LANDING_DEFAULTS.laurels);
</script>

<Section id="voices" eyebrow={VOICES.eyebrow} title={VOICES.title} align="center" voice="serif">
	<ul use:stagger={60} class="scroll-in mb-12 flex flex-wrap items-stretch justify-center gap-3 md:mb-16" aria-label="Figures">
		{#each laurels as l}
			<li class="laurel flex items-center gap-2 rounded-full border border-line bg-surface-2/70 px-4 py-2.5 backdrop-blur-sm">
				<svg viewBox="0 0 24 40" class="h-8 w-5 text-accent" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M20 38C10 34 4 26 4 14M4 14c4 0 7 2 8 6M4 14c-1-4 0-8 2-12M6 22c3 0 6 2 7 6M9 30c3 0 5 1 7 4" /></svg>
				<span class="text-center"><span class="block font-mono text-[18px] font-bold leading-none text-ink">{l.value}</span><span class="label-mono mt-1 block text-ink-3">{l.label}</span></span>
				<svg viewBox="0 0 24 40" class="h-8 w-5 -scale-x-100 text-accent" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M20 38C10 34 4 26 4 14M4 14c4 0 7 2 8 6M4 14c-1-4 0-8 2-12M6 22c3 0 6 2 7 6M9 30c3 0 5 1 7 4" /></svg>
			</li>
		{/each}
	</ul>
	<div use:stagger={110} class="scroll-in grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each testimonials as t, i}
			<figure use:tilt={4} class="spot ring-hover relative flex flex-col rounded-3xl border border-line bg-surface-2 p-7 transition-[border-color] duration-300 hover:border-accent/50" style="--reveal-delay:{i * 110}ms">
				<span aria-hidden="true" class="voice-serif absolute right-6 top-2 text-[96px] leading-none text-accent/20">“</span>
				<blockquote class="voice-serif relative text-[21px] leading-snug text-ink">{t.quote}</blockquote>
				<figcaption class="relative mt-auto flex items-center gap-3 pt-7">
					<span class="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-bg font-mono text-[13px] font-bold text-accent">{t.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
					<span><span class="block text-[14.5px] font-semibold text-ink">{t.name}</span><span class="label-mono mt-0.5 block text-ink-3">{t.role}</span></span>
				</figcaption>
			</figure>
		{/each}
	</div>
</Section>
