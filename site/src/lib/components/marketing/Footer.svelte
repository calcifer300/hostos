<script lang="ts">
	import Logo from '$lib/components/ui/Logo.svelte';
	import { FOOTER, SITE } from '$lib/content/site';
	const year = new Date().getFullYear();
</script>

<footer class="tone-dark border-t border-line">
	<div class="container-x grid grid-cols-1 gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
		<div>
			<Logo />
			<p class="mt-4 max-w-xs text-[14px] leading-relaxed text-ink-3">Operations, systems and software for growing businesses. Founded by John Jenrique Briones · Manila · working on your hours.</p>
			<p class="label-mono mt-6 text-ink-3">{SITE.email}</p>
		</div>
		{#each FOOTER.columns as col}
			<nav aria-label={col.title}>
				<p class="label-mono mb-4 text-ink-3">{col.title}</p>
				<ul class="space-y-2.5">
					{#each col.links as [label, href]}<li><a {href} class="text-[14px] text-ink-2 transition-colors hover:text-ink">{label}</a></li>{/each}
				</ul>
			</nav>
		{/each}
	</div>
	<div aria-hidden="true" class="container-wide overflow-hidden pb-2 pt-6">
		<p class="wordmark-giant translate-y-[0.18em]">hostOS</p>
	</div>
	<div class="border-t border-line">
		<div class="container-x flex flex-col gap-2 py-5 text-[12.5px] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
			<span>© {year} {SITE.company}. All rights reserved.</span>
			<span class="label-mono">Built and run on HostOS</span>
		</div>
	</div>
</footer>
