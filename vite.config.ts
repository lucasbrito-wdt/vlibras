import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: './src',
    define: {
        'import.meta.env.VITE_TRANSLATOR_URL': JSON.stringify('https://traducao2.vlibras.gov.br/translate'),
        'import.meta.env.VITE_DICTIONARY_URL': JSON.stringify('https://dicionario2.vlibras.gov.br/2018.3.1/WEBGL/'),
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
});
