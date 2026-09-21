<script lang="ts">
	import { onMount } from 'svelte';
	/**
	 * A constellation in the members' colours: points with threads between
	 * the ones that lie close. Drawn once, as a still — it reads as a drawing
	 * behind the collage, never as a screensaver. Same drawing as the app's
	 * team page.
	 */
	let { hues, class: cls = '', density = 28 }: { hues: string[]; class?: string; density?: number } = $props();
	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx || hues.length === 0) return;
		// a seeded scatter, so the drawing is the same on every visit
		let seed = 7;
		const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
		const nodes = Array.from({ length: density }, (_, i) => ({ x: rand(), y: rand(), hue: hues[i % hues.length], r: 1.4 + rand() * 1.6, p: 0.65 + 0.35 * rand() }));
		let w = 0, h = 0;
		const REACH = 170;
		const size = () => { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); w = r.width; h = r.height; canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr)); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
		const draw = () => {
			ctx.clearRect(0, 0, w, h);
			ctx.lineWidth = 1;
			for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
				const a = nodes[i], b = nodes[j], d = Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
				if (d > REACH) continue;
				ctx.globalAlpha = (1 - d / REACH) * 0.22; ctx.strokeStyle = a.hue;
				ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
			}
			for (const n of nodes) {
				ctx.fillStyle = n.hue;
				ctx.globalAlpha = 0.55 * n.p; ctx.beginPath(); ctx.arc(n.x * w, n.y * h, n.r, 0, Math.PI * 2); ctx.fill();
				ctx.globalAlpha = 0.12 * n.p; ctx.beginPath(); ctx.arc(n.x * w, n.y * h, n.r * 4, 0, Math.PI * 2); ctx.fill();
			}
			ctx.globalAlpha = 1;
		};
		size();
		draw();
		// redrawn only when the canvas changes size
		const ro = new ResizeObserver(() => { size(); draw(); });
		ro.observe(canvas);
		return () => ro.disconnect();
	});
</script>

<canvas bind:this={canvas} aria-hidden="true" class={cls}></canvas>
