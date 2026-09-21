<script lang="ts">
	import { onMount } from 'svelte';
	/**
	 * A slow constellation in the members' colours: points drifting, threads
	 * between the ones that come close. Runs only while on screen; a still
	 * frame under reduced motion. Same drawing as the app's team page.
	 */
	let { hues, class: cls = '', density = 28 }: { hues: string[]; class?: string; density?: number } = $props();
	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx || hues.length === 0) return;
		const nodes = Array.from({ length: density }, (_, i) => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.018, vy: (Math.random() - 0.5) * 0.018, hue: hues[i % hues.length], r: 1.4 + Math.random() * 1.6, phase: Math.random() * Math.PI * 2 }));
		let w = 0, h = 0, raf = 0, last = 0, visible = true;
		const REACH = 170;
		const size = () => { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); w = r.width; h = r.height; canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr)); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
		const draw = (t: number) => {
			ctx.clearRect(0, 0, w, h);
			ctx.lineWidth = 1;
			for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
				const a = nodes[i], b = nodes[j], d = Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
				if (d > REACH) continue;
				ctx.globalAlpha = (1 - d / REACH) * 0.22; ctx.strokeStyle = a.hue;
				ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
			}
			for (const n of nodes) {
				const p = 0.65 + 0.35 * Math.sin(t / 900 + n.phase);
				ctx.fillStyle = n.hue;
				ctx.globalAlpha = 0.55 * p; ctx.beginPath(); ctx.arc(n.x * w, n.y * h, n.r, 0, Math.PI * 2); ctx.fill();
				ctx.globalAlpha = 0.12 * p; ctx.beginPath(); ctx.arc(n.x * w, n.y * h, n.r * 4, 0, Math.PI * 2); ctx.fill();
			}
			ctx.globalAlpha = 1;
		};
		const step = (t: number) => {
			const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
			for (const n of nodes) { n.x += n.vx * dt; n.y += n.vy * dt; if (n.x < -0.02 || n.x > 1.02) n.vx *= -1; if (n.y < -0.02 || n.y > 1.02) n.vy *= -1; }
			draw(t); raf = requestAnimationFrame(step);
		};
		size();
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(0); return; }
		const start = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(step); } };
		const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
		const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { rootMargin: '80px' });
		io.observe(canvas);
		const ro = new ResizeObserver(() => { size(); if (!raf) draw(0); });
		ro.observe(canvas);
		const vis = () => (document.hidden ? stop() : start());
		document.addEventListener('visibilitychange', vis);
		return () => { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', vis); };
	});
</script>

<canvas bind:this={canvas} aria-hidden="true" class={cls}></canvas>
