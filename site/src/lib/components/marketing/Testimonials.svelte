<script lang="ts">
	import { getContext } from 'svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import { stagger, tilt } from '$lib/components/motion/actions';
	import { RECOGNITION, VOICES } from '$lib/content/site';
	import { emph, plain } from '$lib/content/emph';
	import Laurel from '$lib/components/ui/Laurel.svelte';
	import { LANDING_DEFAULTS, listOr, type Landing } from '$lib/content/remote';
	/**
	 * Owners in their own words, then what the team is trusted for. Both
	 * lists are the Founder's to edit in the app; nothing here is invented
	 * for the page. The company's figures stand under the hero and are not
	 * repeated here.
	 */
	const landing = getContext<Landing | undefined>('landing');
	const testimonials = $derived(landing?.testimonials ?? LANDING_DEFAULTS.testimonials);
	const marks = $derived(listOr(landing?.lists?.recognition, RECOGNITION.marks, (r) => ({ name: r.a, note: r.b })));
</script>

<Section id="voices" eyebrow={VOICES.eyebrow} title={VOICES.title} align="center">
	<div use:stagger={110} class="scroll-in grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each testimonials as t, i}
			<figure use:tilt={4} class="spot ring-hover relative flex flex-col rounded-3xl border border-line bg-surface-2 p-7 transition-[border-color] duration-300 hover:border-accent/50" style="--reveal-delay:{i * 110}ms">
				<svg aria-hidden="true" viewBox="0 0 24 24" class="absolute right-6 top-6 h-8 w-8 text-accent/35" fill="currentColor"><path d="M7.5 5C4.5 5 2.5 7.3 2.5 10.4c0 2.8 1.9 4.8 4.4 4.8-.3 1.9-1.6 3.2-3.3 3.8v1.9c3.9-.6 6.9-3.8 6.9-8.8C10.5 7.6 9.3 5 7.5 5Zm11 0c-3 0-5 2.3-5 5.4 0 2.8 1.9 4.8 4.4 4.8-.3 1.9-1.6 3.2-3.3 3.8v1.9c3.9-.6 6.9-3.8 6.9-8.8 0-4.5-1.2-7.1-3-7.1Z" /></svg>
				<blockquote class="relative pr-10 text-[17.5px] font-medium leading-relaxed text-ink">{t.quote}</blockquote>
				<figcaption class="relative mt-auto flex items-center gap-3 pt-7">
					{#if t.photo}<img src={t.photo} alt="" width="44" height="44" loading="lazy" class="h-11 w-11 shrink-0 rounded-full border border-line object-cover" />{:else}<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-bg font-mono text-[13px] font-bold text-accent">{t.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>{/if}
					<span><span class="block text-[14.5px] font-semibold text-ink">{t.name}</span><span class="label-mono mt-0.5 block text-ink-3">{t.role}</span></span>
				</figcaption>
			</figure>
		{/each}
	</div>
	<!-- recognition: the wreath flanks the statement; the disciplines beneath it (the figures stand under the hero and are not repeated) -->
	<div use:stagger={80} class="scroll-in mx-auto mt-16 max-w-4xl text-center md:mt-24">
		<div class="flex items-center justify-center gap-4 md:gap-8">
<Laurel leaves={9} class="h-20 w-11 shrink-0 md:h-28 md:w-16" />
			<h3 class="display-2 headline" aria-label={plain(RECOGNITION.title)}>{@html emph(RECOGNITION.title)}</h3>
<Laurel flip leaves={9} class="h-20 w-11 shrink-0 md:h-28 md:w-16" />
		</div>
		<p class="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{RECOGNITION.body}</p>
		<ul class="mt-8 flex flex-wrap items-start justify-center gap-x-10 gap-y-5" aria-label="What we are trusted for">
			{#each marks as m}
				<li class="max-w-[180px] text-center"><p class="text-[17px] font-bold tracking-tight text-ink">{m.name}</p><p class="label-mono mt-1 !text-[9.5px] text-ink-3">{m.note}</p></li>
			{/each}
		</ul>
	</div>
</Section>
