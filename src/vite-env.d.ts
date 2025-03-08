/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_TRANSLATOR_URL: string;
    readonly VITE_DICTIONARY_URL: string;
    readonly VITE_DICTIONARY_STATIC_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
