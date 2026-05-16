/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string;
  readonly VITE_SURPRISE_CODE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
