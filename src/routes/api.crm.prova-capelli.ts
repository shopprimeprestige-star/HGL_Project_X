/** ── LA CLASSIFICA DEI TAGLI, PER CHI STA DENTRO ───────────────────────────
 *
 *  GET → quante volte è stato scelto ogni taglio, quale colore va per la
 *  maggiore, e quante prove sono partite da una foto portata dalla persona.
 *
 *  ── ⚠️ NON È PUBBLICA, ED È VOLUTO ───────────────────────────────────────
 *  «Il taglio più scelto» è un dato di mestiere: dice cosa la gente vuole
 *  davvero prima ancora di entrare in negozio, e vale per chi lo legge quanto
 *  vale per un concorrente. Sta dietro allo stesso permesso delle altre cose
 *  del gestionale.
 *
 *  ⚠️ E non c'è niente delle persone: solo contatori. Vedi `prova/classifica`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { classifica, classificaColori } from "@/prova/classifica";
import { COLORI, TAGLI } from "@/prova/tagli";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";
import { leggiClassifica } from "./api.public.prova-capelli";

const PERMESSO = "impostazioni" as const;

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/prova-capelli")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const chi = await chiamanteCRM(request);
        if (!chi) return nonAutenticatoCRM({});
        if (!chi.accesso.puo(PERMESSO)) return vietatoCRM({}, PERMESSO);

        const c = await leggiClassifica();
        return json({
          ok: true,
          totale: c.totale,
          daFoto: c.daFoto,
          dal: c.dal ?? null,
          al: c.al ?? null,
          //  Si mandano già ORDINATI e con la percentuale: il conto è lo stesso
          //  per tutti, e farlo nel browser vuol dire due posti dove può
          //  sbagliare invece di uno.
          tagli: classifica(c, TAGLI).map((r) => ({
            ...r,
            famiglia: TAGLI.find((t) => t.chiave === r.chiave)?.famiglia ?? "",
          })),
          colori: classificaColori(c, COLORI),
        });
      },
    },
  },
});
