<script lang="ts">
	import { BadgeDollarSign, ClipboardCheck, Clock, KeyRound, Layers, Users } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import { stagger, tilt } from '$lib/components/motion/actions';
	import { WHY } from '$lib/content/site';
	/** The case for us — and for a team based in the Philippines — made in six plain reasons. */
	const icons = { hours: Clock, people: Users, one: Layers, value: BadgeDollarSign, own: KeyRound, plan: ClipboardCheck } as const;
	const hues = ['#3b9cff', '#30d158', '#8b7cff', '#ff9f0a', '#40c8e0', '#ff375f'];
</script>

<Section id="why" eyebrow={WHY.eyebrow} title={WHY.title} lede={WHY.lede} align="center" tone="surface">
	<div use:stagger={70} class="scroll-in grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each WHY.reasons as r, i}
			{@const Icon = icons[r.id as keyof typeof icons]}
			<article use:tilt={4} class="spot ring-hover group relative flex flex-col rounded-2xl border border-line bg-surface-2 p-6 transition-[border-color,box-shadow] duration-300 hover:shadow-1" style={`--spot:${hues[i]}; --hue:${hues[i]}`}>
				<div class="flex items-start justify-between">
					<span class="grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface-3" style={`color:${hues[i]}`}><Icon class="h-5 w-5" strokeWidth={1.75} /></span>
					<span class="label-mono text-ink-3">0{i + 1}</span>
				</div>
				<h3 class="mt-5 text-[19px] font-semibold tracking-tight text-ink">{r.name}</h3>
				<p class="mt-3 text-[14.5px] leading-relaxed text-ink-2">{r.body}</p>
				<span aria-hidden="true" class="mt-auto block h-1 w-10 rounded-full pt-0 transition-[width] duration-500 group-hover:w-20" style={`background:${hues[i]}; margin-top: 1.25rem`}></span>
			</article>
		{/each}
	</div>
	<p class="mx-auto mt-10 max-w-3xl text-center text-[15px] leading-relaxed text-ink-3">HostOS Collective is a Philippine company. Our operators are employed, trained and covered by us; our clients are mostly in the United States, and the board, the procedures and the software are the same wherever you are.</p>
</Section>

<style>
	article:hover { border-color: color-mix(in oklab, var(--hue) 55%, var(--color-line)); }
</style>
