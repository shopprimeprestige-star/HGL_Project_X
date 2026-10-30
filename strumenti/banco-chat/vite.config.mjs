import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const qui = dirname(fileURLToPath(import.meta.url));
const src = resolve(qui, "../../src");
/** Al posto dei tre moduli di rete/archivio, quelli finti del banco. */
const SOSTITUTI = {
  [resolve(src, "crm/CRMContext")]: resolve(qui, "stub-crm.tsx"),
  [resolve(src, "crm/AuthContext")]: resolve(qui, "stub-crm.tsx"),
  [resolve(src, "integrations/supabase/client")]: resolve(qui, "supabase-finto.ts"),
};
const finti = {
  name: "banco-chat-finti",
  enforce: "pre",
  async resolveId(source, importer, opz) {
    if (!importer) return null;
    //  L'alias `@` arriva già risolto (percorso assoluto); i relativi si risolvono dall'importatore.
    const base = source.startsWith("@/")
      ? resolve(src, source.slice(2))
      : source.startsWith(".")
        ? resolve(dirname(importer), source)
        : source;
    return SOSTITUTI[base.replace(/\.[tj]sx?$/, "")] ?? null;
  },
};
export default defineConfig({
  root: qui,
  plugins: [finti, react(), tailwind()],
  resolve: { alias: { "@": src } },
  build: { outDir: resolve(qui, "dist"), emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
});
