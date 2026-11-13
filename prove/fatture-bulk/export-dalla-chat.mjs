/** ── FATTURE BULK · T0b (commessa 2026-11-13-fatture-dalla-chat) ───────────
 *  Due simboli della bulk diventano `export`, PER LA MODALITÀ «DALLA CHAT»
 *  (PIANO §1/§4-T0b): `centroOk` (emissione.server.ts) e `ETICHETTA_STATO`/
 *  `STILE_STATO` (AnteprimaBulk.tsx). Zero righe di logica cambiate: questa
 *  prova verifica che siano ora IMPORTABILI e che il VALORE non sia cambiato.
 *  ⚠️ `AnteprimaBulk.tsx` non è impacchettato in MODULI (è un componente React
 *   con `lucide-react`/`@/components/ui/*`: bundlarlo qui vorrebbe dire toccare
 *   la mappatura di `prove/prove.mjs`, fuori dal vincolo «soli export» di T0b).
 *   Si legge perciò il SORGENTE con `radice` e si confronta il blocco esatto:
 *   stessa tecnica già in uso altrove in questa suite per verificare un testo
 *   di sorgente senza eseguire il modulo. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Il blocco letterale di oggi (13/11/2026), prima del fix di T0b: se cambiasse
 *  anche di una virgola, la prova deve accorgersene — non è un controllo «esiste». */
const ETICHETTA_STATO_ATTESO = `{
  pronto: "Pronto",
  da_controllare: "Da controllare",
  errore: "Errore",
  confermata: "Confermata",
  emessa: "Emessa",
  scartata: "Scartata",
}`;
const STILE_STATO_ATTESO = `{
  pronto: { classe: "border-emerald-200 bg-emerald-50 text-emerald-800", icona: CheckCircle2 },
  da_controllare: { classe: "border-amber-200 bg-amber-50 text-amber-900", icona: AlertTriangle },
  errore: { classe: "border-rose-200 bg-rose-50 text-rose-800", icona: XCircle },
  confermata: { classe: "border-sky-200 bg-sky-50 text-sky-800", icona: CheckCheck },
  emessa: { classe: "border-emerald-300 bg-emerald-100 text-emerald-900", icona: FileCheck2 },
  scartata: { classe: "border-slate-200 bg-slate-100 text-slate-600", icona: Ban },
}`;

/** Spazi/a-capo fuori dalle stringhe non contano: conta solo il contenuto. */
const senzaSpazi = (s) => s.replace(/\s+/g, " ").trim();

/** Estrae il VALORE assegnato a `const nome: Tipo<...> = {...};`, a parentesi bilanciate
 *  (niente regex greedy su `{...}`). Si parte dal segno «=» dell'assegnazione, non dai due punti
 *  del tipo: `STILE_STATO` ha un `{ classe: ...; icona: ... }` già dentro il SUO tipo, prima di «=». */
function estraiBlocco(src, nome) {
  const inizioDichiarazione = src.indexOf(`const ${nome}`);
  const uguale = src.indexOf("=", inizioDichiarazione);
  const apre = src.indexOf("{", uguale);
  if (apre < 0) return null;
  let livello = 0;
  for (let i = apre; i < src.length; i++) {
    if (src[i] === "{") livello++;
    else if (src[i] === "}") {
      livello--;
      if (livello === 0) return src.slice(apre, i + 1);
    }
  }
  return null;
}

export async function prove(mod, { c, gruppo, radice }) {
  const EM = mod["fatture/bulk/emissione.server"];
  const RL = mod["fatture/bulk/regole-lotto"];
  const BS = mod["fatture/bulk/bulk.server"];
  const FT = mod["fatture/tipi"];

  gruppo("BULK · T0b · centroOk È ORA export, STESSO COMPORTAMENTO");
  c("centroOk è una funzione importabile (prima era privata)", "function", typeof EM.centroOk);

  // Un archivio finto che non ha MAI dati dell'azienda (leggiAziendaSu torna AZIENDA_VUOTA):
  // basta a esercitare centroOk, che usa solo `porte.archivio`.
  const porteVuote = { archivio: { leggi: async () => null } };

  // (1) La firma della testata NON combacia con quella del centro attuale → si ferma,
  //     SENZA nemmeno guardare `controllaLotto` (R1, il controllo più a buon mercato prima).
  const testataDiversa = {
    lotto: "x",
    creatoIl: "",
    descrizione: "",
    dataSeManca: "",
    firmaImpostazioni: "firma-vecchia-mai-uguale",
  };
  const r1 = await EM.centroOk(porteVuote, testataDiversa);
  c(
    "firma diversa: si ferma con «impostazioni_cambiate», nessun azienda restituita",
    true,
    "stop" in r1,
  );
  c(
    "firma diversa: esito e codice",
    ["ferma", "impostazioni_cambiate"],
    "stop" in r1 ? [r1.stop.esito, r1.stop.codice] : [],
  );
  c(
    "firma diversa: il messaggio è quello di default di ErroreBulk (nessun motivo di controllaLotto incollato)",
    new BS.ErroreBulk("impostazioni_cambiate").messaggio,
    "stop" in r1 ? r1.stop.messaggio : "",
  );

  // (2) La firma combacia (azienda vuota = azienda vuota) → si guarda `controllaLotto`, che per
  //     un'azienda senza NESSUN dato trova sempre qualcosa da bloccare (R2-R4): il messaggio è
  //     l'unione dei `testo` dei motivi, esattamente come calcolato da fuori con le stesse funzioni.
  const firmaVuota = RL.firmaImpostazioni(FT.AZIENDA_VUOTA);
  const testataCombacia = {
    lotto: "x",
    creatoIl: "",
    descrizione: "",
    dataSeManca: "",
    firmaImpostazioni: firmaVuota,
  };
  const r2 = await EM.centroOk(porteVuote, testataCombacia);
  const motiviAttesi = RL.controllaLotto(FT.AZIENDA_VUOTA);
  c(
    "azienda vuota: controllaLotto trova sempre qualcosa da bloccare (altrimenti la prova non proverebbe niente)",
    true,
    motiviAttesi.length > 0,
  );
  c(
    "firma uguale, azienda incompleta: si ferma comunque, stesso codice",
    true,
    "stop" in r2 && r2.stop.esito === "ferma" && r2.stop.codice === "impostazioni_cambiate",
  );
  c(
    "il messaggio è l'unione ESATTA dei motivi di controllaLotto (stessa funzione, stesso import, nessuna copia)",
    motiviAttesi.map((m) => m.testo).join(" "),
    "stop" in r2 ? r2.stop.messaggio : "",
  );

  gruppo("BULK · T0b · ETICHETTA_STATO / STILE_STATO SONO ORA export, STESSO VALORE");
  const src = readFileSync(join(radice, "src/crm/fatture/bulk/AnteprimaBulk.tsx"), "utf8");
  c(
    "ETICHETTA_STATO è dichiarata «export const» (prima era «const»)",
    true,
    /export const ETICHETTA_STATO\s*:/.test(src),
  );
  c(
    "STILE_STATO è dichiarata «export const» (prima era «const»)",
    true,
    /export const STILE_STATO\s*:/.test(src),
  );
  const blocEtichetta = estraiBlocco(src, "ETICHETTA_STATO");
  const blocStile = estraiBlocco(src, "STILE_STATO");
  c(
    "ETICHETTA_STATO: stesso oggetto di prima, carattere per carattere (solo l'export è cambiato)",
    senzaSpazi(ETICHETTA_STATO_ATTESO),
    senzaSpazi(blocEtichetta ?? ""),
  );
  c(
    "STILE_STATO: stesso oggetto di prima, carattere per carattere (solo l'export è cambiato)",
    senzaSpazi(STILE_STATO_ATTESO),
    senzaSpazi(blocStile ?? ""),
  );
}
