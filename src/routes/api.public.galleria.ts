/** RACCOLTE MEDIA — IL LATO CHE LEGGE (chiunque abbia il codice) ────────────
 *  GET ?codice=ACDE-F3HJ-KMN7  -> { ok, galleria: { codice, titolo, voci } }
 *
 *  Nessun accesso, nessun cookie, nessuna sessione: la apre un cliente
 *  qualsiasi dal telefono, ed è il senso stesso del link. Il codice È la
 *  chiave — per questo viene sorteggiato (vedi src/media/galleria.ts).
 *
 *  ⚠️ QUESTA ROTTA SA FARE UNA COSA SOLA. Senza codice non risponde, con un
 *  codice sbagliato risponde "non trovata", e non esiste nessun parametro che
 *  la faccia elencare le raccolte o dire quante ce ne sono. L'elenco vive
 *  nell'altra rotta, dietro la guardia del presentatore: sono due file diversi
 *  proprio perché nessuna modifica futura all'uno possa aprire l'altro.
 *
 *  Si risponde 200 anche quando la raccolta non c'è più: per il cliente non è
 *  un errore, è un link scaduto, e la pagina ha già la sua schermata gentile.
 *  Il 404 resta nel campo `reason` per chi legge i registri.
 */
import { createFileRoute } from "@tanstack/react-router";
import { leggiConfig } from "@/media/config.server";
import { chiaveGalleria, codicePulito, normalizzaGalleria } from "@/media/galleria";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    //  Niente cache condivisa: l'indirizzo contiene la chiave, e queste sono
    //  foto di clienti. Un link ritirato deve smettere di funzionare subito.
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/galleria")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const codice = codicePulito(new URL(request.url).searchParams.get("codice"));
        //  Codice mal scritto: stessa risposta di "non esiste". Distinguere i
        //  due casi direbbe a chi prova a indovinare quando ha imbroccato la
        //  forma giusta.
        if (!codice) return json({ ok: false, reason: "not_found" });

        let grezzo: unknown = null;
        try {
          const raw = await leggiConfig(chiaveGalleria(codice));
          grezzo = raw ? JSON.parse(raw) : null;
        } catch {
          //  Riga illeggibile (JSON rotto a mano dal pannello): per il cliente
          //  è un link non più valido, non una schermata tecnica.
          grezzo = null;
        }
        const g = normalizzaGalleria(grezzo, codice);
        if (!g) return json({ ok: false, reason: "not_found" });

        //  Esce SOLO ciò che serve a disegnare il carosello: né la data di
        //  creazione, né chi l'ha fatta, né niente che riguardi le altre.
        return json({
          ok: true,
          galleria: { codice: g.codice, titolo: g.titolo ?? "", voci: g.voci },
        });
      },
    },
  },
});
