/** ── PROVE: TRE RITOCCHI AI FILTRI DELLA CHAT (31/10/2026) ───────────────────
 *  1. La ✕ del foglio «Filtri» sul telefono: bottone nostro da 44×44 px, «Chiudi i filtri»;
 *     la ✕ di serie (16 px, «Close») è nascosta e `ui/sheet.tsx` (condiviso) NON cambia.
 *  2. «Da rispondere»: tasto, riepilogo ed elenco dicono lo stesso numero. Il filtro mostra TUTTE le
 *     chat che aspettano, anche ferme da mesi, e non c'è più un riquadro a parte «oltre 7 giorni».
 *  3. «Azzera» (e ogni modo di spegnere «Da chiamare») riporta anche Stato della chiamata e
 *     Quando richiamare a «Tutti».
 *  Le parti di disegno si leggono dal sorgente, come nelle altre prove di questa cartella.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveFiltriRitocchi(mod, { c, gruppo, radice }) {
  const F = mod["chatwa/filtri"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const pannello = senzaCommenti(leggi("src/crm/chatwa/PannelloFiltri.tsx"));
  const elenco = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));

  // ── 1. La ✕ del foglio ───────────────────────────────────────────────────────────────────────
  gruppo("RITOCCHI FILTRI · LA ✕ DEL FOGLIO È DA 44 px E IN ITALIANO");
  const foglio = pannello.match(/<SheetContent[\s\S]*?\n\s*>/)?.[0] ?? "";
  c("la ✕ di serie del foglio è nascosta", true, /\[&>button\]:hidden/.test(foglio));
  const chiudi =
    pannello.match(/<button[^>]*?aria-label="Chiudi i filtri"[\s\S]*?<\/button>/)?.[0] ?? "";
  c("c'è un bottone «Chiudi i filtri»", true, chiudi !== "");
  c("area di tocco 44×44 px (h-11 w-11)", true, /\bh-11\b/.test(chiudi) && /\bw-11\b/.test(chiudi));
  c("chiude il pannello", true, /onClick=\{\(\) => onApri\(false\)\}/.test(chiudi));
  c(
    "compare solo sul telefono (nel riquadro ancorato non serve)",
    true,
    /piccolo && \(\s*<button[^>]*?\s*type="button"\s*aria-label="Chiudi i filtri"/.test(pannello),
  );
  c("la ✕ non copre più «Azzera»: niente spazio riservato a destra", false, /pr-12/.test(pannello));
  const sheet = leggi("src/components/ui/sheet.tsx");
  c(
    "il foglio condiviso non è toccato (la sua ✕ resta com'era)",
    true,
    /<span className="sr-only">Close<\/span>/.test(sheet),
  );

  // ── 2. «Da rispondere»: un numero solo ───────────────────────────────────────────────────────
  gruppo("RITOCCHI FILTRI · «DA RISPONDERE»: TASTO, RIEPILOGO ED ELENCO DICONO LO STESSO NUMERO");
  let n = 0;
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333111${String(n).padStart(4, "0")}`,
      unread: 0,
      lead: o.senzaScheda
        ? null
        : { data: { stato: "da_contattare", consulenteId: o.consulente ?? null, payment: null } },
      finestra: null,
      daRispondere: { attesa: o.attesa === true },
    };
  };
  const mondo = [
    chat({ attesa: true }),
    chat({ attesa: true, consulente: "luca" }),
    chat({ attesa: true, senzaScheda: true }),
    // ferma da mesi con l'ultima parola del cliente: aspetta lo stesso (stato.ts: niente limite di età)
    chat({ attesa: true, consulente: "luca" }),
    chat(),
    chat({ consulente: "luca" }),
  ];
  const stelleDi = () => 0;
  const V = F.FILTRI_VUOTI;
  const acceso = F.commuta(V, "coda", "da-rispondere");
  const mostrate = mondo.filter((x) => F.passaFiltri(x, acceso, stelleDi));
  const tasto = F.contaVoce(mondo, acceso, stelleDi, "coda", "da-rispondere");
  c(
    "senza altri filtri: tasto = chat che l'elenco mostra = chat che aspettano",
    [4, 4, 4],
    [tasto, mostrate.length, mondo.filter((x) => x.daRispondere.attesa).length],
  );
  c(
    "il riepilogo «N di M» conta con la stessa funzione del tasto",
    mostrate.length,
    F.contaVisibili(mondo, acceso, stelleDi),
  );
  const conLuca = { ...acceso, consulente: "luca" };
  c(
    "con un consulente: tasto = riepilogo = elenco",
    [2, 2],
    [
      F.contaVoce(mondo, conLuca, stelleDi, "coda", "da-rispondere"),
      F.contaVisibili(mondo, conLuca, stelleDi),
    ],
  );
  c(
    "nessun riquadro a parte «oltre 7 giorni» nell'elenco",
    false,
    /Senza risposta da oltre|oltre 7 giorni/.test(elenco),
  );
  c(
    "il tasto della griglia conta con `contaVoce` (come il filtro)",
    true,
    /n=\{conta\(v\.campo, v\.valore\)\}/.test(elenco),
  );

  // ── 3. «Azzera» toglie anche i sotto-filtri di «Da chiamare» ─────────────────────────────────
  gruppo(
    "RITOCCHI FILTRI · «AZZERA» RIPORTA A «TUTTI» ANCHE STATO DELLA CHIAMATA E QUANDO RICHIAMARE",
  );
  const wrapper =
    elenco.match(/const setFiltri = \(f: FiltriChat\) => \{[\s\S]*?\n  \};/)?.[0] ?? "";
  c("esiste un unico punto da cui passa ogni cambio di filtri", true, wrapper !== "");
  c(
    "fuori da «Da chiamare» riporta lo stato della chiamata a «Tutti»",
    true,
    /f\.coda !== "da-chiamare"[\s\S]*setSotto\("tutti"\)/.test(wrapper),
  );
  c(
    "fuori da «Da chiamare» riporta «Quando richiamare» a «Tutti»",
    true,
    /f\.coda !== "da-chiamare"[\s\S]*setQuando\("tutti"\)/.test(wrapper),
  );
  c("poi salva i filtri", true, /salvaFiltri\(f\)/.test(wrapper));
  c(
    "«Azzera» (riepilogo, elenco vuoto, pannello), «Tutte» e le ✕ usano quel punto, non il salvataggio diretto",
    [],
    elenco
      .split("\n")
      .filter((r) => /salvaFiltri/.test(r) && !/setFiltri: salvaFiltri|salvaFiltri\(f\)/.test(r)),
  );
  c(
    "`azzera` svuota i filtri passando da lì",
    true,
    /const azzera = \(\) => setFiltri\(FILTRI_VUOTI\)/.test(elenco),
  );
  c(
    "il pannello azzera con lo stesso `onCambia` (che è `setFiltri`)",
    true,
    /onCambia=\{setFiltri\}/.test(elenco) && /onCambia\(FILTRI_VUOTI\)/.test(pannello),
  );
}
