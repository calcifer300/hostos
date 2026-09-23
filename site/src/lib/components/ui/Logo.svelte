<script lang="ts">
	/**
	 * The hostOS mark — the fingerprint in a rounded square — drawn in a
	 * gradient that moves, the ridges tracing themselves on arrival and a
	 * light passing over the frame now and then. The wordmark's "OS" carries
	 * the same gradient. Same geometry as the product's.
	 */
	let { size = 28, wordmark = true, wordSize = 20, class: cls = '' }: { size?: number; wordmark?: boolean; wordSize?: number; class?: string } = $props();
	const uid = `m${Math.random().toString(36).slice(2, 7)}`;
</script>

<span class={`mark-wrap inline-flex items-center gap-2.5 ${cls}`}>
	<svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" class="mark shrink-0 overflow-visible">
		<defs>
			<linearGradient id="{uid}-g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
				<stop offset="0" stop-color="#3B9CFF" />
				<stop offset="1" stop-color="#9B6BFF" />
			</linearGradient>
			<linearGradient id="{uid}-s" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset="0.5" stop-color="#fff" stop-opacity="0.9" /><stop offset="1" stop-color="#fff" stop-opacity="0" />
			</linearGradient>
			<clipPath id="{uid}-c"><rect x="6" y="6" width="52" height="52" rx="15" /></clipPath>
		</defs>
		<rect class="frame" x="6" y="6" width="52" height="52" rx="15" stroke="url(#{uid}-g)" stroke-width="3.25" pathLength="1" />
		<g class="print" stroke="url(#{uid}-g)" stroke-width="3" stroke-linecap="round">
			<path d="M14 44V30a18 18 0 0 1 36 0v8" pathLength="1" />
			<path d="M20.5 50V30a11.5 11.5 0 0 1 23 0v12" pathLength="1" />
			<path d="M26.5 46V30.5a5.5 5.5 0 0 1 11 0v13" pathLength="1" />
			<path d="M32 36v17" pathLength="1" />
		</g>
		<g clip-path="url(#{uid}-c)"><rect class="sheen" x="-30" y="0" width="26" height="64" fill="url(#{uid}-s)" transform="skewX(-20)" /></g>
	</svg>
	{#if wordmark}
		<span class="font-bold tracking-tight text-ink" style={`font-size:${wordSize}px`}>host<span class="os">OS</span></span>
	{/if}
</span>

<style>
	.frame, .print path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.1s var(--ease-out-expo) forwards; }
	.print path:nth-child(1) { animation-delay: 0.2s; }
	.print path:nth-child(2) { animation-delay: 0.35s; }
	.print path:nth-child(3) { animation-delay: 0.5s; }
	.print path:nth-child(4) { animation-delay: 0.65s; }
	.sheen { transform: skewX(-20deg); }
	.mark-wrap:hover .sheen { animation: sheen 1.2s ease-in-out 1; }
	.os {
		background: linear-gradient(92deg, #3b9cff, #6a5cf5, #9b6bff);
		background-size: 200% 100%;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	@keyframes draw { to { stroke-dashoffset: 0; } }
	@keyframes sheen { from { transform: translateX(0) skewX(-20deg); } to { transform: translateX(110px) skewX(-20deg); } }
	@media (prefers-reduced-motion: reduce) { .frame, .print path { animation: none; stroke-dashoffset: 0; } .sheen { animation: none; } }
</style>
