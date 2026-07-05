// `.md` files are imported as strings (esbuild `text` loader at build time,
// a matching Vite plugin under vitest). See `tsup.config.ts` / `vitest.config.ts`.
declare module "*.md" {
	const content: string;
	export default content;
}
