<script lang="ts">
	import { onMount } from 'svelte';
	import { Pause, Play } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import { lazyVideo, reveal } from '$lib/components/motion/actions';
	import { FILM } from '$lib/content/site';
	let { chapters = FILM.chapters }: { chapters?: typeof FILM.chapters } = $props();

	/**
	 * The film: four chapters of one working day. Real footage on the left,
	 * the board's events on the right, in step. Plays itself while on
	 * screen (12 s a chapter), pauses off screen, scrubs by chapter. Under
	 * reduced motion or data saver the footage stays a still and the
	 * events simply show.
	 */
	const SECS = 12;
	let chapter = $state(0);
	let playing = $state(false);
	let progress = $state(0); // 0..1 within the chapter
	let shown = $state(0); // events revealed in the current chapter
	let root = $state<HTMLElement | null>(null);
	let inView = $state(false);
	const current = $derived(chapters[chapter]);

	function go(i: number, resume = true) {
		chapter = ((i % chapters.length) + chapters.length) % chapters.length;
		progress = 0;
		shown = 0;
		playing = resume;
	}

	onMount(() => {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) { shown = 3; return; }
		const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && !playing && progress === 0) playing = true; }, { threshold: 0.35 });
		if (root) io.observe(root);
		let last = 0, raf = 0;
		const tick = (t: number) => {
			if (playing && inView) {
				const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
				progress = Math.min(1, progress + dt / SECS);
				shown = Math.min(current.events.length, Math.floor(progress * (current.events.length + 1)));
				if (progress >= 1) go(chapter + 1);
			}
			last = t;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => { io.disconnect(); cancelAnimationFrame(raf); };
	});
</script>

<Section id="film" eyebrow={FILM.eyebrow} title={FILM.title} lede={FILM.lede} wide voice="grotesk" align="center">
	<div bind:this={root} use:reveal class="overflow-hidden rounded-3xl border border-line bg-surface-1 shadow-2">
		<div class="grid lg:grid-cols-[1.35fr_1fr]">
			<!-- footage -->
			<div class="relative aspect-[16/10] bg-bg lg:aspect-auto lg:min-h-[520px]">
				<!-- before the footage arrives (or where it never does): the room in the chapter's light -->
				<div aria-hidden="true" class="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent_60%),radial-gradient(ellipse_at_80%_80%,color-mix(in_oklab,var(--color-platform)_18%,transparent),transparent_55%)]"></div>
				{#each chapters as c, i (c.id)}
					<div class={`absolute inset-0 transition-opacity duration-1000 ease-[var(--ease-standard)] ${i === chapter ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={i !== chapter}>
						{#if Math.abs(i - chapter) <= 1 || (chapter === 0 && i === chapters.length - 1)}
							{#key c.src}<video class="lazy h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: c.src, always: true }}></video>{/key}
						{/if}
					</div>
				{/each}
				<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,20,0.2),transparent_35%,transparent_60%,rgba(11,13,20,0.85))]"></div>
				<!-- chapter caption -->
				{#key chapter}
					<div class="absolute bottom-5 left-5 right-5">
						<p class="label-mono arrive text-accent">{current.time} · {current.name}</p>
						<p class="arrive mt-2 max-w-md text-[22px] font-semibold leading-tight tracking-tight text-white sm:text-[26px]" style="--reveal-delay:80ms">{current.line}</p>
					</div>
				{/key}
				<button type="button" onclick={() => (playing = !playing)} aria-label={playing ? 'Pause' : 'Play'} class="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60">
					{#if playing}<Pause class="h-4 w-4" />{:else}<Play class="ml-0.5 h-4 w-4" />{/if}
				</button>
			</div>

			<!-- the board, in step -->
			<div class="flex flex-col border-t border-line lg:border-l lg:border-t-0">
				<div class="flex items-center justify-between border-b border-line px-5 py-3">
					<span class="label-mono text-ink-3">app.hostos · the day</span>
					<span class="flex items-center gap-1.5 label-mono text-ok"><span class="h-1.5 w-1.5 rounded-full bg-ok animate-blink"></span>Live</span>
				</div>
				<ol class="flex-1 divide-y divide-line">
					{#each current.events as [t, text], i}
						<li class={`flex items-start gap-4 px-5 py-4 transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)] ${i < shown ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'}`}>
							<span class="font-mono w-12 shrink-0 pt-0.5 text-[12px] text-accent">{t}</span>
							<span class="text-[14.5px] leading-snug text-ink">{text}</span>
						</li>
					{/each}
				</ol>
				<!-- chapters + progress -->
				<div class="border-t border-line p-3">
					<div class="grid grid-cols-4 gap-2" role="tablist" aria-label="Chapters">
						{#each chapters as c, i}
							<button type="button" role="tab" aria-selected={i === chapter} onclick={() => go(i)} class={`rounded-xl border px-2 py-2 text-left transition-colors ${i === chapter ? 'border-accent/60 bg-accent/10' : 'border-line hover:border-line-strong'}`}>
								<span class="label-mono block text-ink-3">{c.time}</span>
								<span class="mt-0.5 block text-[12.5px] font-medium text-ink">{c.name}</span>
								<span class="mt-2 block h-[3px] overflow-hidden rounded-full bg-line"><span class="block h-full origin-left rounded-full bg-accent" style={`transform:scaleX(${i < chapter ? 1 : i === chapter ? progress : 0})`}></span></span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</Section>
