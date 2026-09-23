<script lang="ts">
	import { onMount } from 'svelte';
	import { Car, MessageSquare, Wrench } from 'lucide-svelte';
	/**
	 * The signature visual: an operations board that is alive. Three events on
	 * a nine-second loop — a job moves to a tech, a car flips to "back", a
	 * guest message arrives and is answered — then it rests. Static under
	 * reduced motion. Drawn, not photographed: the software is the proof.
	 */
	type Col = { title: string; items: { id: string; text: string; who?: string }[] };
	let cols = $state<Col[]>([
		{ title: 'Open', items: [{ id: 'j1', text: 'Chip repair · Cedar Park · 14:00' }, { id: 'j2', text: 'Side glass · Round Rock · 11:30' }] },
		{ title: 'Assigned', items: [{ id: 'j3', text: 'Windshield · Austin · 10:00', who: 'Ramon' }] },
		{ title: 'Done', items: [{ id: 'j4', text: 'Windshield · Georgetown · 08:00', who: 'Miguel' }] }
	]);
	let carBack = $state(false);
	let message = $state<'none' | 'in' | 'answered'>('none');
	let step = $state(0);
	let root: HTMLDivElement;

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { message = 'answered'; carBack = true; return; }
		const timers: number[] = [];
		const run = () => {
			step = 0; carBack = false; message = 'none';
			timers.push(window.setTimeout(() => { const j = cols[0].items.shift(); if (j) cols[1].items.unshift({ ...j, who: 'Jess' }); step = 1; }, 1500));
			timers.push(window.setTimeout(() => { carBack = true; step = 2; }, 4000));
			timers.push(window.setTimeout(() => { message = 'in'; step = 3; }, 6000));
			timers.push(window.setTimeout(() => { message = 'answered'; }, 7600));
			timers.push(window.setTimeout(() => { const j = cols[1].items.pop(); if (j) cols[0].items.push({ id: j.id, text: j.text }); }, 8900));
		};
		// once, when the board comes into view — a story, not a loop
		const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.4 });
		io.observe(root);
		return () => { io.disconnect(); timers.forEach(clearTimeout); };
	});
</script>

<div bind:this={root} class="mac relative overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2" aria-label="A live HostOS operations board (demo)" role="img">
	<div aria-hidden="true" class="macbar flex items-center gap-1.5 border-b border-line bg-surface-3/80 px-3 py-2"><span class="h-2.5 w-2.5 rounded-full bg-[#ff5f57]"></span><span class="h-2.5 w-2.5 rounded-full bg-[#febc2e]"></span><span class="h-2.5 w-2.5 rounded-full bg-[#28c840]"></span><span class="label-mono ml-3 !text-[9.5px] text-ink-3">app.hostos</span></div>
	<div class="p-3 sm:p-4">
	<div class="mb-3 flex items-center justify-between px-1">
		<span class="label-mono text-ink-3">app.hostos · Dispatch · Today</span>
		<span class="flex items-center gap-1.5 label-mono text-ok"><span class="h-1.5 w-1.5 rounded-full bg-ok"></span>Live</span>
	</div>
	<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
		{#each cols as col, ci}
			<div class="rounded-2xl border border-line bg-bg/60 p-2.5">
				<p class="label-mono mb-2 px-1 text-ink-3">{col.title} <span class="text-ink-2">{col.items.length}</span></p>
				<ul class="space-y-2">
					{#each col.items as it (it.id)}
						<li class={`rounded-xl border px-2.5 py-2 text-[12px] leading-snug transition-all duration-500 ease-[var(--ease-out-expo)] ${ci === 1 && step === 1 && it.who === 'Jess' ? 'border-accent/70 bg-accent/10' : 'border-line bg-surface-2'}`}>
							<span class="flex items-start gap-1.5"><Wrench class="mt-0.5 h-3 w-3 shrink-0 text-accent" />{it.text}</span>
							{#if it.who}<span class="mt-1 block label-mono text-ink-3">{it.who}</span>{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
	<div class="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
		<div class={`rounded-2xl border p-3 transition-colors duration-500 ${carBack ? 'border-ok/60 bg-ok/10' : 'border-line bg-bg/60'}`}>
			<p class="label-mono text-ink-3">Fleet · Civic 4821</p>
			<p class="mt-1.5 flex items-center gap-2 text-[13px] font-medium text-ink"><Car class={`h-4 w-4 ${carBack ? 'text-ok' : 'text-accent'}`} /> {carBack ? 'Back · photos taken · claim window 5 days' : 'Out · due 11:00'}</p>
		</div>
		<div class={`rounded-2xl border p-3 transition-colors duration-500 ${message !== 'none' ? 'border-accent/60 bg-accent/10' : 'border-line bg-bg/60'}`}>
			<p class="label-mono text-ink-3">Guest · Turo</p>
			{#if message === 'none'}
				<p class="mt-1.5 flex items-center gap-2 text-[13px] text-ink-3"><MessageSquare class="h-4 w-4" /> Inbox clear</p>
			{:else if message === 'in'}
				<p class="mt-1.5 flex items-center gap-2 text-[13px] text-ink"><MessageSquare class="h-4 w-4 text-accent" /> “Can I pick up an hour early?”</p>
			{:else}
				<p class="mt-1.5 text-[13px] text-ink">“Yes — 8:40 works. Keys in the lockbox, code sent.” <span class="label-mono text-ok">· answered in 1 min</span></p>
			{/if}
		</div>
	</div>
</div>
</div>
