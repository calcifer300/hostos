<script lang="ts">
	/** The hostOS mark — a fingerprint in a rounded square — with the wordmark. Same geometry as the product's. */
	let { size = 26, wordmark = true, class: cls = '' }: { size?: number; wordmark?: boolean; class?: string } = $props();
</script>

<span class={`inline-flex items-center gap-2.5 ${cls}`}>
	<svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" class="shrink-0">
		<defs>
			<linearGradient id="hostos-frame" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
				<stop offset="0" stop-color="#3B9CFF" /><stop offset="1" stop-color="#9B6BFF" />
			</linearGradient>
			<linearGradient id="hostos-print" x1="32" y1="20" x2="32" y2="54" gradientUnits="userSpaceOnUse">
				<stop offset="0" stop-color="#FFFFFF" /><stop offset="1" stop-color="#B9C6FF" />
			</linearGradient>
		</defs>
		<rect x="6" y="6" width="52" height="52" rx="15" stroke="url(#hostos-frame)" stroke-width="3.25" />
		<path d="M18 46V36a14 14 0 0 1 28 0v5" stroke="url(#hostos-print)" stroke-width="3" stroke-linecap="round" />
		<path d="M23 50V36a9 9 0 0 1 18 0v8" stroke="url(#hostos-print)" stroke-width="3" stroke-linecap="round" />
		<path d="M27.5 47.5V36.5a4.5 4.5 0 0 1 9 0v9" stroke="url(#hostos-print)" stroke-width="3" stroke-linecap="round" />
		<path d="M32 40v13" stroke="url(#hostos-print)" stroke-width="3" stroke-linecap="round" />
	</svg>
	{#if wordmark}
		<span class="text-[20px] font-semibold tracking-tight text-ink">host<span class="text-gradient">OS</span></span>
	{/if}
</span>
