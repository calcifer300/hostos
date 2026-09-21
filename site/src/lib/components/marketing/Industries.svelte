<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { stagger, tilt } from '$lib/components/motion/actions';
	import { INDUSTRIES, FILM, VIDEO } from '$lib/content/site';
	/**
	 * Eight tiles; the ones we have footage for play it under the words
	 * while the pointer rests on them (loaded on first hover, never before).
	 */
	const clips: Record<string, string> = { turo: FILM.chapters[0].src, doordash: FILM.chapters[1].src, hospitality: FILM.chapters[1].src, services: FILM.chapters[2].src, small: FILM.chapters[3].src, fleet: VIDEO.hero.src };
	function hoverVideo(el: HTMLElement, src: string | undefined) {
		if (!src || window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};
		let video: HTMLVideoElement | null = null;
		const enter = () => {
			if (!video) {
				video = document.createElement('video');
				video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none';
				video.className = 'lazy absolute inset-0 h-full w-full object-cover opacity-0';
				video.addEventListener('playing', () => video?.classList.add('is-playing'));
				video.src = src;
				el.prepend(video);
			}
			video.play().catch(() => {});
		};
		const leave = () => { video?.pause(); };
		el.addEventListener('pointerenter', enter);
		el.addEventListener('pointerleave', leave);
		return { destroy() { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); video?.remove(); } };
	}
</script>

<Section id="industries" eyebrow={INDUSTRIES.eyebrow} title={INDUSTRIES.title}>
	<div use:stagger={50} class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each INDUSTRIES.items as ind}
			<a href={ind.href} use:tilt={5} use:hoverVideo={clips[ind.id]} class="industry spot ring-hover group relative block overflow-hidden rounded-2xl border border-line bg-surface-2 p-5 transition-[border-color,box-shadow] duration-300 hover:shadow-1" style={`--spot:${ind.hue}; --hue:${ind.hue}`}>
				<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(22,26,38,0.35),var(--color-surface-2)_85%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
				<div class="relative">
					<span class="block h-1.5 w-8 rounded-full transition-[width] duration-500 group-hover:w-14" style={`background:${ind.hue}`}></span>
					<h3 class="mt-5 text-[16px] font-semibold tracking-tight text-ink">{ind.name}</h3>
					<p class="mt-1 text-[13px] text-ink-3">{ind.line}</p>
				</div>
			</a>
		{/each}
	</div>
</Section>

<style>
	.industry:hover {
		border-color: color-mix(in oklab, var(--hue) 55%, var(--color-line));
	}
	.industry :global(video) {
		mix-blend-mode: luminosity;
		opacity: 0;
	}
	.industry :global(video.is-playing) {
		opacity: 0.45;
	}
</style>
