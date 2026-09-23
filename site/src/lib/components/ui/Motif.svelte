<script lang="ts">
	/**
	 * Small animated drawings, one per idea, in `currentColor`. Pure SVG +
	 * CSS keyframes (app.css "m-*"), so they cost nothing and stop under
	 * reduced motion. Used as a section's signature or a card's icon.
	 */
	export type MotifKind =
		| 'schedule' | 'blocks' | 'nodes' | 'chart'            // solution families
		| 'people' | 'checklist' | 'board'                     // how it works
		| 'tablet' | 'camera' | 'envelope' | 'globe' | 'head' | 'bank' // problems
		| 'calendar';
	let { kind, class: cls = '' }: { kind: MotifKind; class?: string } = $props();
	const c = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
</script>

<svg viewBox="0 0 120 120" class={`motif ${cls}`} aria-hidden="true">
	{#if kind === 'schedule'}
		{#each [30, 48, 66, 84] as y, i}<rect x="22" y={y} width={[62, 40, 74, 52][i]} height="10" rx="5" fill="currentColor" opacity={0.25 + i * 0.15} class="m-stack" style={`animation-delay:${i * 0.5}s`} />{/each}
		<line x1="22" y1="22" x2="22" y2="98" {...c} opacity="0.5" />
		<circle cx="22" cy="60" r="4" fill="currentColor" class="m-pulse" />
	{:else if kind === 'blocks'}
		{#each [[30, 60], [58, 60], [86, 60], [44, 36], [72, 36], [58, 12]] as [x, y], i}<rect x={x - 12} y={y} width="24" height="20" rx="4" {...c} fill="currentColor" fill-opacity={0.08 + i * 0.05} class="m-stack" style={`animation-delay:${i * 0.35}s`} />{/each}
	{:else if kind === 'nodes'}
		<path d="M24 84 L60 36 L96 84 Z" {...c} class="m-flow" />
		<path d="M24 84 L96 84" {...c} class="m-flow" />
		{#each [[24, 84], [60, 36], [96, 84]] as [x, y], i}<circle cx={x} cy={y} r="6" fill="currentColor" class="m-pulse" style={`animation-delay:${i * 0.6}s`} />{/each}
		<circle cx="60" cy="68" r="4" fill="currentColor" opacity="0.6" class="m-blink" />
	{:else if kind === 'chart'}
		{#each [24, 42, 60, 78] as x, i}<rect x={x} y={90 - (i + 1) * 12} width="10" height={(i + 1) * 12} rx="2" fill="currentColor" opacity="0.22" />{/each}
		<path d="M20 84l18-20 16 10 18-28 14 12 14-20" {...c} stroke-width="2.5" class="m-draw" />
		<circle cx="100" cy="38" r="4" fill="currentColor" class="m-pulse" />
	{:else if kind === 'people'}
		<circle cx="60" cy="60" r="38" {...c} opacity="0.3" stroke-dasharray="4 8" class="m-spin" />
		<g class="m-orbit"><circle cx="60" cy="60" r="38" fill="none" stroke="none" /><circle cx="60" cy="22" r="6" fill="currentColor" /></g>
		<g class="m-spin-rev"><circle cx="60" cy="60" r="24" fill="none" stroke="none" /><circle cx="84" cy="60" r="5" fill="currentColor" opacity="0.8" /></g>
		<circle cx="60" cy="60" r="9" fill="currentColor" />
	{:else if kind === 'checklist'}
		{#each [34, 54, 74] as y, i}
			<rect x="22" y={y - 7} width="14" height="14" rx="3" {...c} />
			<path d={`M25 ${y}l4 4 6-8`} {...c} class="m-tick" style={`animation-delay:${i}s`} />
			<line x1="46" y1={y} x2={98 - i * 14} y2={y} {...c} opacity="0.5" />
		{/each}
	{:else if kind === 'board'}
		{#each [22, 50, 78] as x, i}
			<rect x={x} y="22" width="20" height="76" rx="4" {...c} opacity="0.6" />
			<rect x={x + 4} y="28" width="12" height="9" rx="2" fill="currentColor" opacity="0.9" class="m-slide" style={`animation-delay:${i * 0.7}s`} />
			<rect x={x + 4} y="42" width="12" height="9" rx="2" fill="currentColor" opacity="0.4" class="m-slide" style={`animation-delay:${i * 0.7 + 0.35}s`} />
		{/each}
	{:else if kind === 'tablet'}
		<rect x="30" y="20" width="60" height="80" rx="8" {...c} />
		<rect x="38" y="30" width="44" height="52" rx="3" fill="currentColor" opacity="0.15" />
		<path d="M52 46v20M68 46v20" {...c} stroke-width="4" class="m-blink" />
	{:else if kind === 'camera'}
		<rect x="22" y="40" width="76" height="50" rx="8" {...c} />
		<circle cx="60" cy="65" r="14" {...c} />
		<circle cx="60" cy="65" r="6" fill="currentColor" opacity="0.6" />
		<rect x="22" y="40" width="76" height="50" rx="8" fill="currentColor" class="m-flash" />
	{:else if kind === 'envelope'}
		<rect x="22" y="36" width="76" height="52" rx="6" {...c} />
		<path d="M22 42l38 26 38-26" {...c} />
		<circle cx="94" cy="38" r="7" fill="currentColor" class="m-pulse" />
	{:else if kind === 'globe'}
		<circle cx="60" cy="60" r="34" {...c} />
		<path d="M26 60h68M60 26c-12 12-12 56 0 68M60 26c12 12 12 56 0 68" {...c} opacity="0.6" />
		<line x1="20" y1="60" x2="100" y2="60" stroke="currentColor" stroke-width="2" class="m-scan" opacity="0.7" />
	{:else if kind === 'head'}
		<circle cx="60" cy="46" r="18" {...c} />
		<path d="M30 98c4-18 14-26 30-26s26 8 30 26" {...c} />
		{#each [0, 1, 2] as i}<circle cx={48 + i * 12} cy="46" r="2.5" fill="currentColor" class="m-blink" style={`animation-delay:${i * 0.35}s`} />{/each}
	{:else if kind === 'bank'}
		{#each [28, 44, 60, 76] as x, i}<rect x={x} y={70 - i * 12} width="10" height={30 + i * 12} rx="2" fill="currentColor" opacity="0.3" class="m-rise" style={`animation-delay:${i * 0.3}s`} />{/each}
		<path d="M24 92h72" {...c} />
		<circle cx="96" cy="34" r="5" fill="currentColor" class="m-pulse" />
	{:else if kind === 'calendar'}
		<rect x="22" y="26" width="76" height="70" rx="6" {...c} />
		<path d="M22 44h76" {...c} />
		{#each Array.from({ length: 12 }, (_, i) => i) as i}<rect x={30 + (i % 4) * 16} y={52 + Math.floor(i / 4) * 14} width="10" height="8" rx="2" fill="currentColor" opacity={i < 7 ? 0.9 : 0.25} class={i < 7 ? 'm-pulse' : ''} style={`animation-delay:${i * 0.2}s`} />{/each}
	{/if}
</svg>
