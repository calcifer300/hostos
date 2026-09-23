<script lang="ts">
	/**
	 * One week of a fleet's operations, 7 days × 24 hours. Before: the owner
	 * covers it, mostly at night and on weekends, with gaps nobody covers.
	 * After: operators cover every hour; the owner's cells are one quiet
	 * read each morning. Cells cross-fade when the toggle flips.
	 */
	let { after }: { after: boolean } = $props();
	const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	// deterministic "randomness" so the picture is the same on every visit
	const noise = (d: number, h: number) => Math.abs(Math.sin(d * 12.9898 + h * 78.233) * 43758.5453) % 1;
	type Cell = 'owner' | 'ops' | 'gap' | 'read';
	const before = (d: number, h: number): Cell => (h >= 8 && h < 18 && d < 5 ? (noise(d, h) < 0.75 ? 'owner' : 'gap') : noise(d, h) < 0.45 ? 'owner' : 'gap');
	const afterMap = (d: number, h: number): Cell => (h === 8 ? 'read' : 'ops');
	const colour: Record<Cell, string> = { owner: 'var(--color-warn)', gap: 'var(--color-danger)', ops: 'var(--color-accent)', read: 'var(--color-ok)' };
	const alpha: Record<Cell, number> = { owner: 0.85, gap: 0.55, ops: 0.55, read: 1 };
	const cell = (d: number, h: number) => (after ? afterMap(d, h) : before(d, h));
</script>

<figure class="rounded-2xl border border-line bg-bg/60 p-4">
	<svg viewBox="0 0 300 130" class="h-auto w-full" role="img" aria-label={after ? 'After: operators cover every hour; the owner reads at 8 AM' : 'Before: the owner covers nights and weekends, with gaps'}>
		{#each Array.from({ length: 24 }, (_, h) => h) as h}
			{#if h % 6 === 0}<text x={34 + h * 11 + 4} y="8" class="fill-ink-3 font-mono" font-size="6" text-anchor="middle">{String(h).padStart(2, '0')}</text>{/if}
		{/each}
		{#each days as day, d}
			<text x="0" y={22 + d * 15} class="fill-ink-3 font-mono" font-size="7">{day}</text>
			{#each Array.from({ length: 24 }, (_, h) => h) as h}
				{@const k = cell(d, h)}
				<rect class="cell" x={34 + h * 11} y={16 + d * 15} width="9" height="9" rx="2" fill={colour[k]} opacity={alpha[k]} />
			{/each}
		{/each}
	</svg>
	<figcaption class="mt-3 flex flex-wrap gap-x-5 gap-y-1 label-mono text-ink-3">
		{#if after}
			<span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-accent"></i>Operators</span>
			<span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-ok"></i>Owner reads the board</span>
		{:else}
			<span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-warn"></i>Owner on the phone</span>
			<span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-danger/70"></i>Nobody</span>
		{/if}
	</figcaption>
</figure>
