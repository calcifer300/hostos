<script lang="ts">
	import { ArrowUpRight } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { reveal } from '$lib/components/motion/actions';
	import { PLATFORM, SITE } from '$lib/content/site';
	/** A read-only look at the kind of screens an owner reads: tabs, KPIs, a list. Keyboard-operable; nothing here is a screenshot. */
	import { onMount } from 'svelte';
	let tab = $state(0);
	let touched = $state(false);
	let beat = $state(0); // increments every few seconds; drives the ticking values and the arriving row
	const current = $derived(PLATFORM.tabs[tab]);
	// small honest movements: a count goes up by one, a time shifts by a minute, a row is added on top
	const live = (value: string, i: number) => {
		const n = parseInt(value, 10);
		if (Number.isNaN(n) || beat === 0) return value;
		const bump = ((beat + i) % 3 === 0 ? 1 : 0);
		return value.replace(String(n), String(n + bump));
	};
	const arriving = $derived([['now', 'Guest reply · 47 s'], ['now', 'Tablet check · all stores open'], ['now', 'Estimate #1051 chased']][beat % 3]);
	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const t = window.setInterval(() => { beat += 1; if (!touched && beat % 4 === 0) tab = (tab + 1) % PLATFORM.tabs.length; }, 3500);
		return () => window.clearInterval(t);
	});
	const onKey = (e: KeyboardEvent) => {
		if (e.key === 'ArrowRight') tab = (tab + 1) % PLATFORM.tabs.length;
		if (e.key === 'ArrowLeft') tab = (tab - 1 + PLATFORM.tabs.length) % PLATFORM.tabs.length;
	};
</script>

<Section id="platform" eyebrow={PLATFORM.eyebrow} title={PLATFORM.title} lede={PLATFORM.lede} voice="grotesk" align="split">
	<div use:reveal class="relative overflow-hidden rounded-3xl border border-line bg-surface-2 shadow-2">
		<div aria-hidden="true" class="macbar flex items-center gap-1.5 border-b border-line bg-surface-3/80 px-3 py-2"><span class="h-2.5 w-2.5 rounded-full bg-[#ff5f57]"></span><span class="h-2.5 w-2.5 rounded-full bg-[#febc2e]"></span><span class="h-2.5 w-2.5 rounded-full bg-[#28c840]"></span><span class="label-mono ml-3 !text-[9.5px] text-ink-3">app.hostos</span></div>
		<div aria-hidden="true" class="intro-scan pointer-events-none absolute inset-x-0 z-10 h-px bg-[linear-gradient(90deg,transparent,var(--color-accent),transparent)] opacity-40"></div>
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
			<div class="flex items-center gap-2">
				<span class="flex gap-1.5" aria-hidden="true"><span class="h-2.5 w-2.5 rounded-full bg-danger/70"></span><span class="h-2.5 w-2.5 rounded-full bg-warn/70"></span><span class="h-2.5 w-2.5 rounded-full bg-ok/70"></span></span>
				<span class="label-mono ml-2 text-ink-3">app.hostoscollective.com</span>
			</div>
			<div class="flex rounded-full border border-line bg-bg p-1" role="tablist" aria-label="Screens" tabindex="-1" onkeydown={onKey}>
				{#each PLATFORM.tabs as t, i}
					<button type="button" role="tab" aria-selected={tab === i} aria-controls={`demo-${t.id}`} tabindex={tab === i ? 0 : -1} onclick={() => { tab = i; touched = true; }} class={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${tab === i ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink'}`}>{t.name}</button>
				{/each}
			</div>
		</div>
		{#key tab}
			<div id={`demo-${current.id}`} role="tabpanel" class="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
				{#each current.widgets as w, i}
					{#if w.kind === 'kpi'}
						<div class="reveal is-in rounded-2xl border border-line bg-surface-2 p-4" style={`--reveal-delay:${i * 60}ms`}>
							<p class="label-mono text-ink-3">{w.label}</p>
							{#key beat}<p class="tick mt-2 text-[30px] font-semibold leading-none tracking-tight text-ink">{live(w.value ?? "", i)}</p>{/key}
							<p class="mt-2 text-[12.5px] text-ink-3">{w.note}</p>
						</div>
					{:else}
						<div class="reveal is-in rounded-2xl border border-line bg-surface-2 p-4 md:col-span-4" style={`--reveal-delay:${i * 60}ms`}>
							<p class="label-mono mb-3 text-ink-3">{w.label}</p>
							<ul class="divide-y divide-line">
								{#if beat > 0}{#key beat}<li class="tick flex items-center gap-4 py-2.5 text-[13.5px]"><span class="font-mono w-16 shrink-0 text-ok">{arriving[0]}</span><span class="text-ink">{arriving[1]}</span></li>{/key}{/if}
								{#each w.rows ?? [] as [a, b]}
									<li class="flex items-center gap-4 py-2.5 text-[13.5px]"><span class="font-mono w-16 shrink-0 text-accent">{a}</span><span class="text-ink">{b}</span></li>
								{/each}
							</ul>
						</div>
					{/if}
				{/each}
			</div>
		{/key}
	</div>
	<div class="mt-8 flex flex-wrap items-center gap-3">
		<Button href={SITE.login} variant="secondary">Open HostOS <ArrowUpRight class="h-4 w-4" /></Button>
		<p class="text-[13px] text-ink-3">Clients and the team sign in with Google. Every business gets its own dashboard; one login.</p>
	</div>
</Section>
