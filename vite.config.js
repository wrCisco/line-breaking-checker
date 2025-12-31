// vite.config.js
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: './resources/*.json',
                    dest: './resources',
                },
                {
                    src: './resources/LICENSE.txt',
                    dest: './resources',
                },
            ],
        }),
    ],
    build: {
        lib: {
            entry: {'src/linebreakingchecker': 'src/linebreakingchecker.mjs'},
            formats: ['es'],
        },
        minify: true,
        sourcemap: false,
        manifest: true,
        rollupOptions: {
            preserveEntrySignatures: "strict",
        },
    },
});