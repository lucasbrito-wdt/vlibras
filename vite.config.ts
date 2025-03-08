import { defineConfig } from 'vite';
import { resolve } from 'path';
import {viteStaticCopy} from "vite-plugin-static-copy";

export default defineConfig({
    root: './src',
    define: {
        'import.meta.env.VITE_TRANSLATOR_URL': JSON.stringify('https://traducao2-dth.vlibras.gov.br/dl/translate'),
        'import.meta.env.VITE_DICTIONARY_URL': JSON.stringify('https://dicionario2.vlibras.gov.br/static/BUNDLES/2018.3.1/WEBGL/'),
        'import.meta.env.VITE_DICTIONARY_STATIC_URL': JSON.stringify('https://dicionario2.vlibras.gov.br/static/BUNDLES/2018.3.1/WEBGL/BR/')
    },
    resolve: {
        alias: {
            '~': resolve(__dirname, 'src'),
            events: './src/EventEmitter.ts'
        }
    },
    optimizeDeps: {
        exclude: ['events']
    },
    build: {
        outDir: '../public',
        target: 'esnext',
        rollupOptions: {
            input: './src/index.html',
        },
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: 'src/target',
                    dest: ''
                }
            ]
        })
    ]
});
