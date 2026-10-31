import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const qui = dirname(fileURLToPath(import.meta.url));
const src = resolve(qui, "../../src");
/** Al posto dei moduli di rete/archivio e del router, quelli finti del banco «Oggi». */
const SOSTITUTI = {
  [resolve(src, "crm/CRMContext")]: resolve(qui, "stub-oggi.tsx"),
  [resolve(src, "crm/AuthContext")]: resolve(qui, "stub-oggi.tsx"),
  [resolve(src, "integrations/supabase/client")]: resolve(qui, "supabase-oggi.ts"),
};
const finti = {
  name: "banco-oggi-finti",
  enforce: "pre",
  async resolveId(source, importer) {
    if (source === "@tanstack/react-router") return resolve(qui, "stub-oggi.tsx");
    if (!importer) return null;
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
  server: { port: 5198, strictPort: true },
});
