/** ── A CHI HO GIÀ SCRITTO, OGGI ────────────────────────────────────────────
 *
 *  Una lista di quaranta righe si lavora scendendo, e a metà mattina la
 *  domanda non è più «a chi devo scrivere» ma «a questo gli ho già scritto?».
 *  Senza una risposta si riapre WhatsApp per controllare — quaranta volte — o
 *  peggio si scrive due volte alla stessa persona, che dall'altra parte si
 *  legge come un invio automatico.
 *
 *  Chi riceve un messaggio da qui si tinge di azzurro chiaro nella lista.
 *
 *  ── ⚠️ IL SEGNO SCADE DA SOLO, IN DUE MODI ───────────────────────────────
 *   · SE CAMBIA LO STATO, il segno cade. Chiesto dal committente, ed è la
 *     regola giusta: lo stato cambia quando è successo qualcosa — ha risposto,
 *     ha fissato, ha detto no — e da quel momento il messaggio di prima
 *     appartiene a una conversazione finita. La riga torna da lavorare.
 *   · SE CAMBIA IL GIORNO, il segno cade. «Gli ho scritto» vuol dire oggi: una
 *     riga verde di ieri, stamattina, direbbe una cosa falsa nel modo più
 *     insidioso — sembrando vera.
 *
 *  ── DOVE VIVE ────────────────────────────────────────────────────────────
 *  In memoria, con una copia in `sessionStorage`: il giro passa da più
 *  schermate e un segno che si perde cambiando pagina non serve a niente. Non
 *  va sul server di proposito: è un appunto della giornata di CHI sta
 *  telefonando, non un dato della scheda — e scriverlo sul lead vorrebbe dire
 *  farlo vedere anche a chi quel messaggio non l'ha mandato.
 */
const CHIAVE = "hg.crm.scritti";

const ascoltatori = new Set<() => void>();

/** Quello che si ricorda di una riga: com'era lo stato quando le ho scritto, e
 *  in che giorno. Bastano questi due per far scadere il segno da solo. */
export interface Scritto {
  stato: string;
  giorno: string;
}

export type Scritti = Record<string, Scritto>;

/** ⚠️ La parte che si può provare senza un browser. Segna e dimentica sono la
 *  stessa funzione: due strade separate divergono, e il giorno che una delle
 *  due smette di normalizzare lo stato il segno non cade più. */
export function segna(mappa: Scritti, id: string, stato: string, giorno: string): Scritti {
  const k = String(id ?? "").trim();
  if (!k || !giorno) return mappa;
  return { ...mappa, [k]: { stato: String(stato ?? ""), giorno } };
}

/** Se quella riga risulta già scritta OGGI e con QUESTO stato. */
export function risulta(mappa: Scritti, id: string, stato: string, giorno: string): boolean {
  const s = mappa[String(id ?? "").trim()];
  if (!s) return false;
  return s.giorno === giorno && s.stato === String(stato ?? "");
}

/** Toglie quello che non vale più: righe di ieri, e righe il cui stato è
 *  cambiato. ⚠️ Serve a non far crescere la memoria all'infinito, ma
 *  soprattutto a non tenersi dentro un segno che tornerebbe buono se lo stato
 *  tornasse indietro — «ha già ricevuto» non deve poter resuscitare. */
export function potaScritti(mappa: Scritti, giorno: string): Scritti {
  const dopo: Scritti = {};
  for (const [k, v] of Object.entries(mappa)) {
    if (v.giorno === giorno) dopo[k] = v;
  }
  return dopo;
}

function leggi(): Scritti {
  try {
    const grezzo = sessionStorage.getItem(CHIAVE);
    const letto = grezzo ? (JSON.parse(grezzo) as unknown) : {};
    if (!letto || typeof letto !== "object") return {};
    const dentro: Scritti = {};
    for (const [k, v] of Object.entries(letto as Record<string, unknown>)) {
      const r = v as { stato?: unknown; giorno?: unknown };
      if (typeof r?.giorno === "string") {
        dentro[k] = { stato: String(r.stato ?? ""), giorno: r.giorno };
      }
    }
    return dentro;
  } catch {
    //  Incognito, memoria piena, JSON storto: si riparte senza segni. È lo
    //  stato innocuo — una riga da riguardare, non una da saltare.
    return {};
  }
}

let mappa: Scritti = typeof sessionStorage === "undefined" ? {} : leggi();

function salva(): void {
  try {
    sessionStorage.setItem(CHIAVE, JSON.stringify(mappa));
  } catch {
    /* pazienza: vale per questa schermata */
  }
}

export function segnaScritto(id: string, stato: string, giorno: string): void {
  const dopo = segna(potaScritti(mappa, giorno), id, stato, giorno);
  if (dopo === mappa) return;
  mappa = dopo;
  salva();
  for (const f of ascoltatori) f();
}

export function eScritto(id: string, stato: string, giorno: string): boolean {
  return risulta(mappa, id, stato, giorno);
}

export function ascoltaScritti(f: () => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}
