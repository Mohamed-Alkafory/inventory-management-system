/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend, e.g. https://api.prodexa.com/api */
  readonly VITE_API_URL?: string;
  /** "true" → use the in-browser mock API instead of the backend. */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
