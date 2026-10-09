/** ── AGGIUNGERE UN TAGLIO AL CATALOGO, DALLA PAGINA ────────────────────────
 *
 *  POST { codice, foto } → solo con un codice admin.
 *
 *  ⚠️ La procedura vera sta in `prova/crea-taglio.server`, ed è la stessa che
 *   usa il gestionale: due copie della stessa cosa divergono al primo ritocco,
 *   e la prima volta che divergono lo si scopre da un taglio che dalla pagina
 *   esce bene e dal gestionale esce storto, senza che nessuno capisca perché.
 *   Qui resta solo la PORTA: chi può entrare, e con che foto.
 */
import { createFileRoute } from "@tanstack/react-router";
import { creaTaglioDaFoto } from "@/prova/crea-taglio.server";
import { catalogoIntero, confermaTaglio, nascondi, togliTaglio } from "@/prova/catalogo.server";
import { trovaCodice } from "@/prova/archivio.server";
import { formaValida } from "@/prova/codici";
import { fotoAccettabile } from "@/prova/tagli";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/prova-taglio-nuovo")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      //  L'elenco COMPLETO — compresi i nuovi da confermare e i nascosti — per
      //  chi ha un codice admin: è la stessa vista del gestionale, ma dalla
      //  pagina, dove sta chi ha appena caricato la foto.
      GET: async ({ request }) => {
        const codice = new URL(request.url).searchParams.get("codice") || "";
        const scheda = formaValida(codice) ? await trovaCodice(codice) : null;
        if (!scheda?.admin) return json({ ok: false, errore: "serve un codice admin" }, 403);
        return json({ ok: true, tagli: await catalogoIntero(true) });
      },

      POST: async ({ request }) => {
        let b: { codice?: string; foto?: string; azione?: string; chiave?: string; spento?: boolean };
        try { b = (await request.json()) as typeof b; } catch { return json({ ok: false, errore: "richiesta illeggibile" }, 400); }

        const codice = String(b.codice || "");
        if (!formaValida(codice)) return json({ ok: false, errore: "Serve un codice." }, 401);
        const scheda = await trovaCodice(codice);
        if (!scheda) return json({ ok: false, errore: "Questo codice non esiste." }, 401);
        //  ⚠️ Solo admin: ogni taglio nuovo costa due generazioni vere e
        //   cambia la vetrina che vedono tutti i clienti.
        if (!scheda.admin) return json({ ok: false, errore: "Questo codice non può aggiungere tagli." }, 403);
        if (scheda.bloccato) return json({ ok: false, errore: "Questo codice non è più attivo." }, 401);

        //  ── I TRE GESTI SUL TAGLIO APPENA FATTO ─────────────────────────
        //   Confermarlo, nasconderlo, buttarlo. Stanno qui e non solo nel
        //   gestionale perché il momento in cui si decide è QUESTO: si è appena
        //   guardata l'anteprima. Farsi portare altrove per premere una spunta
        //   vuol dire che la spunta non si preme, e il taglio resta in bozza
        //   per sempre.
        if (b.azione === "conferma") {
          const fatto = await confermaTaglio(String(b.chiave || ""));
          return json({ ok: !!fatto, taglio: fatto });
        }
        if (b.azione === "nascondi") {
          await nascondi(String(b.chiave || ""), b.spento !== false);
          return json({ ok: true });
        }
        if (b.azione === "togli") {
          await togliTaglio(String(b.chiave || ""));
          return json({ ok: true });
        }

        const buona = fotoAccettabile(String(b.foto || ""));
        if (!buona.ok) return json({ ok: false, errore: buona.perche }, 400);

        try {
          const taglio = await creaTaglioDaFoto({
            foto: String(b.foto || ""),
            origine: new URL(request.url).origin,
            daChi: scheda.codice,
          });
          return json({ ok: true, taglio });
        } catch (e) {
          return json({ ok: false, errore: String((e as Error).message || e) }, 502);
        }
      },
    },
  },
});
