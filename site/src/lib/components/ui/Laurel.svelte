<script lang="ts">
	/**
	 * A laurel branch in gold: a curved stem with leaves on both sides, filled
	 * with a metal gradient and glowing on a slow pulse. `flip` mirrors it for
	 * the right-hand side. Drawn from a few numbers so every size is crisp.
	 */
	let { class: cls = '', flip = false, leaves = 7 }: { class?: string; flip?: boolean; leaves?: number } = $props();
	const uid = `l${Math.random().toString(36).slice(2, 7)}`;
	// the stem: a quadratic curve from the top, bowing left, to the bottom
	const P0 = { x: 30, y: 4 }, P1 = { x: -4, y: 40 }, P2 = { x: 30, y: 76 };
	const at = (t: number) => ({ x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t ** 2 * P2.x, y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t ** 2 * P2.y });
	const tangent = (t: number) => { const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x), dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y); return (Math.atan2(dy, dx) * 180) / Math.PI; };
	const items = $derived(Array.from({ length: leaves }, (_, i) => {
		const t = 0.1 + (i / (leaves - 1)) * 0.82;
		const p = at(t);
		// leaves lean up the stem toward the tip (the tangent runs downward, so turn it around), and grow from the tip to the base
		const a = tangent(t) + 180;
		const s = 0.5 + 0.55 * (i / (leaves - 1));
		return { p, a, s };
	}));
</script>

<svg viewBox="-6 0 44 80" class={`laurel ${flip ? '-scale-x-100' : ''} ${cls}`} aria-hidden="true">
	<defs>
		<linearGradient id="{uid}-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b3" /><stop offset="0.4" stop-color="#f1c14a" /><stop offset="0.7" stop-color="#c8931a" /><stop offset="1" stop-color="#f6dc8c" /></linearGradient>
	</defs>
	<path d={`M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`} fill="none" stroke="url(#{uid}-g)" stroke-width="1.6" stroke-linecap="round" />
	{#each items as it}
		<g transform={`translate(${it.p.x} ${it.p.y}) rotate(${it.a}) scale(${it.s})`} fill="url(#{uid}-g)">
			<path d="M0 0 C 3 -5, 9 -7, 14 -4 C 10 0, 4 2, 0 0 Z" transform="rotate(-30)" />
			<path d="M0 0 C 3 5, 9 7, 14 4 C 10 0, 4 -2, 0 0 Z" transform="rotate(30)" />
		</g>
	{/each}
</svg>

<style>
	.laurel { filter: drop-shadow(0 0 3px rgb(240 190 60 / 0.4)); }
</style>
