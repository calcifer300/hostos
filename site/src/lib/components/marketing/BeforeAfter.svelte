<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { reveal } from '$lib/components/motion/actions';
	import { BEFORE_AFTER } from '$lib/content/site';
	import WeekMap from './WeekMap.svelte';
	let after = $state(true);
	const options = [
		{ label: 'Before', value: false },
		{ label: 'After', value: true }
	];
</script>

<Section id="before-after" eyebrow={BEFORE_AFTER.eyebrow} title={BEFORE_AFTER.title} lede={BEFORE_AFTER.lede}>
	<div use:reveal class="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
	<div class="overflow-hidden rounded-3xl border border-line bg-surface-2">
		<div class="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
			<p class="label-mono text-ink-3">Same fleet · same month of the year</p>
			<div class="flex rounded-full border border-line bg-bg p-1" role="group" aria-label="Before or after">
				{#each options as o}
					<button type="button" aria-pressed={after === o.value} onclick={() => (after = o.value)} class={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${after === o.value ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:text-ink'}`}>{o.label}</button>
				{/each}
			</div>
		</div>
		<dl class="divide-y divide-line">
			{#each BEFORE_AFTER.rows as r}
				<div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[180px_1fr] sm:items-center">
					<dt class="label-mono text-ink-3">{r.label}</dt>
					<dd class="relative min-h-[24px] text-[15px]">
						<span class={`absolute inset-0 transition-[opacity,transform] duration-400 ease-[var(--ease-out-expo)] ${after ? 'pointer-events-none -translate-y-1 opacity-0' : 'opacity-100'} text-ink-2`} aria-hidden={after}>{r.before}</span>
						<span class={`absolute inset-0 transition-[opacity,transform] duration-400 ease-[var(--ease-out-expo)] ${after ? 'opacity-100' : 'pointer-events-none translate-y-1 opacity-0'} font-medium text-ink`} aria-hidden={!after}>{r.after}</span>
					</dd>
				</div>
			{/each}
		</dl>
	</div>
	<div class="lg:sticky lg:top-28">
		<p class="label-mono mb-3 text-ink-3">The owner’s week · who covers each hour</p>
		<WeekMap {after} />
	</div>
	</div>
</Section>
