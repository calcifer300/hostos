import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Runes everywhere in our own code (Svelte 5); libraries decide for themselves.
				runes: ({ filename }) => (filename.includes('node_modules') ? undefined : true)
			},
			adapter: adapter({ runtime: 'nodejs22.x' }),
			// The marketing site is prerendered where it can be; dynamic bits are islands.
			prerender: { handleHttpError: 'warn', entries: ['*', '/robots.txt', '/sitemap.xml'] }
		})
	]
});
