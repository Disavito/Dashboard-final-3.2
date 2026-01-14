/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INVOICING_API_BASE_URL: string;
  readonly VITE_INVOICING_API_AUTH_TOKEN: string;
  // más variables de entorno aquí...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
