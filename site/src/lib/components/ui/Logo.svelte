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
				<stop offset="0" stop-color="#3B9CFF"><animate attributeName="stop-color" values="#3B9CFF;#6A5CF5;#2C3EF3;#3B9CFF" dur="9s" repeatCount="indefinite" /></stop>
				<stop offset="1" stop-color="#9B6BFF"><animate attributeName="stop-color" values="#9B6BFF;#3B9CFF;#8B7CFF;#9B6BFF" dur="9s" repeatCount="indefinite" /></stop>
			</linearGradient>
			<linearGradient id="{uid}-s" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset="0.5" stop-color="#fff" stop-opacity="0.9" /><stop offset="1" stop-color="#fff" stop-opacity="0" />
			</linearGradient>
			<clipPath id="{uid}-c"><rect x="6" y="6" width="52" height="52" rx="15" /></clipPath>
		</defs>
		<rect class="halo" x="6" y="6" width="52" height="52" rx="15" stroke="url(#{uid}-g)" stroke-width="3.25" opacity="0.35" />
		<rect class="frame" x="6" y="6" width="52" height="52" rx="15" stroke="url(#{uid}-g)" stroke-width="3.25" pathLength="1" />
		<g class="print" stroke="url(#{uid}-g)" stroke-width="3" stroke-linecap="round">
			<path d="M18 46V36a14 14 0 0 1 28 0v5" pathLength="1" />
			<path d="M23 50V36a9 9 0 0 1 18 0v8" pathLength="1" />
			<path d="M27.5 47.5V36.5a4.5 4.5 0 0 1 9 0v9" pathLength="1" />
			<path d="M32 40v13" pathLength="1" />
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
	.halo { animation: halo 4s ease-in-out infinite; transform-origin: 32px 32px; }
	.sheen { animation: sheen 6s ease-in-out infinite; animation-delay: 1.5s; }
	.mark-wrap:hover .sheen { animation-duration: 1.2s; animation-delay: 0s; }
	.os {
		background: linear-gradient(92deg, #3b9cff, #6a5cf5, #9b6bff);
		background-size: 200% 100%;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		animation: os-shift 6s ease-in-out infinite;
	}
	@keyframes draw { to { stroke-dashoffset: 0; } }
	@keyframes halo { 0%, 100% { transform: scale(1); opacity: 0.35; } 50% { transform: scale(1.12); opacity: 0; } }
	@keyframes sheen { 0%, 70%, 100% { transform: translateX(0) skewX(-20deg); } 30% { transform: translateX(110px) skewX(-20deg); } }
	@keyframes os-shift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
	@media (prefers-reduced-motion: reduce) { .frame, .print path { animation: none; stroke-dashoffset: 0; } .halo, .sheen, .os { animation: none; } }
</style>
