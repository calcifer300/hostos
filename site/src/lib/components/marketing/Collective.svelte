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

<Section id="collective" eyebrow="The Collective" title="A collective, not a hierarchy chart." lede="Twelve people who each own a craft, work inside the same HostOS workspace, and answer to the same clients. What we sell is what we use.">
	<div class="relative isolate">
	<div aria-hidden="true" class="pointer-events-none absolute -inset-x-8 -inset-y-12 -z-20 overflow-hidden rounded-[40px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_80%)]">
		<video class="lazy dim h-full w-full object-cover" style="--dim:0.22" muted loop playsinline preload="none" use:lazyVideo={{ src: teamSrc }}></video>
	</div>
	<Constellation hues={members.map((m) => m.hue)} class="pointer-events-none absolute -inset-x-8 -inset-y-12 -z-10 h-[calc(100%+6rem)] w-[calc(100%+4rem)] [mask-image:radial-gradient(ellipse_at_center,#000_55%,transparent_95%)]" />
	<ul use:stagger={45} class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-label="Members">
		{#each members as m}
			<li class="group relative overflow-hidden rounded-2xl border border-line bg-surface-2" style={`--hue:${m.hue}`}>
				<div class="relative aspect-[4/5] overflow-hidden">
					<img src={m.photo} alt={m.name} width="360" height="450" loading="lazy" decoding="async" class="h-full w-full object-cover object-[50%_15%] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.06]" />
					<div aria-hidden="true" class="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,var(--color-surface-2),transparent)]"></div>
					{#if m.founder}<span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur"><Crown class="h-3 w-3" /> Founder</span>{/if}
				</div>
				<div class="px-3 pb-3.5 pt-1">
					<p class="text-[13.5px] font-semibold leading-tight text-ink">{m.name}</p>
					<p class="mt-0.5 text-[11.5px] leading-snug" style={`color:color-mix(in oklab, ${m.hue} 55%, white)`}>{m.title}</p>
				</div>
			</li>
		{/each}
	</ul>
	</div>
	<div class="mt-8"><Button href={`${SITE.url}/team`} variant="secondary">Meet everyone <ArrowUpRight class="h-4 w-4" /></Button></div>
</Section>
