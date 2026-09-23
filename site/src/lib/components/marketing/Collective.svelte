<script lang="ts">
	import { ArrowUpRight, Crown } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { lazyVideo, stagger } from '$lib/components/motion/actions';
	import { SITE, VIDEO } from '$lib/content/site';
	import type { Member } from '$lib/content/team';
	/** The people, as faces. The full roster and the spotlight live on /team in the app. */
	import Constellation from './Constellation.svelte';
	let { members, teamSrc = VIDEO.team }: { members: Member[]; teamSrc?: string } = $props();
</script>

<Section id="collective" eyebrow="The Collective" title="The people behind *your operations*." lede="Twelve people, each responsible for one craft, working in the same HostOS workspace and answering to the same clients. We run our own business on what we sell.">
	<div class="relative isolate">
	<div aria-hidden="true" class="pointer-events-none absolute inset-x-0 -inset-y-12 -z-20 overflow-hidden sm:-inset-x-4 lg:-inset-x-8 rounded-[40px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_80%)]">
		<video class="lazy dim h-full w-full object-cover" style="--dim:0.34" muted loop playsinline preload="none" use:lazyVideo={{ src: teamSrc, still: true }}></video>
	</div>
	<Constellation hues={members.map((m) => m.hue)} class="pointer-events-none absolute inset-x-0 -inset-y-12 -z-10 h-[calc(100%+6rem)] w-full sm:-inset-x-4 sm:w-[calc(100%+2rem)] lg:-inset-x-8 lg:w-[calc(100%+4rem)] [mask-image:radial-gradient(ellipse_at_center,#000_55%,transparent_95%)]" />
	<ul use:stagger={45} class="collage grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-6" aria-label="Members">
		{#each members as m, i}
			<li class="tile group relative text-center" style={`--hue:${m.hue}; --i:${i}`}>
				<div class="relative mx-auto aspect-square w-[78%] overflow-hidden rounded-full border-[3px] border-surface-3 shadow-2 ring-2 ring-[var(--hue)]/40 transition-[box-shadow] duration-500 group-hover:ring-[var(--hue)]">
					<img src={m.photo} alt={m.name} width="360" height="360" loading="lazy" decoding="async" class="h-full w-full scale-[1.06] object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.12]" style={`object-position:${m.focus}`} />
					{#if m.founder}<span class="absolute bottom-0 left-1/2 inline-flex -translate-x-1/2 translate-y-1/2 items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur"><Crown class="h-3 w-3" /> Founder</span>{/if}
				</div>
				<div class="px-1 pt-3 text-center">
					<p class="name text-[14px] font-bold leading-tight tracking-tight">{m.name}</p>
					<p class="role mt-1 text-[12.5px] font-medium leading-snug" style={`--hue:${m.hue}`}>{m.title}</p>
				</div>
			</li>
		{/each}
	</ul>
	</div>
	<div class="mt-10 text-center"><Button href={`${SITE.url}/team`} variant="secondary">Meet the team <ArrowUpRight class="h-4 w-4" /></Button></div>
</Section>

<style>
	/* a collage: every other tile a step down */
	@media (min-width: 640px) {
		.collage .tile:nth-child(even) { margin-top: 28px; }
	}
	.collage .tile:hover { z-index: 2; }
	/* the name in the ink gradient, the role in the serif aside — the house type */
	.name { background: linear-gradient(180deg, var(--color-ink), color-mix(in oklab, var(--color-ink) 70%, var(--hue))); -webkit-background-clip: text; background-clip: text; color: transparent; }
	.role { color: color-mix(in oklab, var(--hue) 60%, #171b27); letter-spacing: 0.01em; }
	@media (prefers-reduced-motion: reduce) { .collage .tile { animation: none; } }
</style>
