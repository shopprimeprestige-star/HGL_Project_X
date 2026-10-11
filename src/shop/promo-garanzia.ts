/** ── LA PROMO DEL SECONDO IMPIANTO ─────────────────────────────────────────
 *
 *  Richiesta del committente, che rovescia il modello di prima:
 *   · «fai che in automatico non c'è nessuna garanzia dei 15 mesi, rimuovila»;
 *   · «fai che posso creare codici promozionali per la garanzia, e che non si
 *     vada ad unificare con codice sconto delle testimonianze: sono due promo
 *     diverse, devono essere applicabili e differenziate anche come voce»;
 *   · «dove posso scegliere o % di sconto su importo oppure prezzo fisso»;
 *   · «rimuovi la tempistica della garanzia, fai che dal secondo impianto in
 *     poi è quel prezzo».
 *
 *  ── COS'È ADESSO ─────────────────────────────────────────────────────────
 *  Non esiste più nessuna promozione automatica: senza un codice, il preventivo
 *  è il preventivo. Quando invece si applica un CODICE GARANZIA, il preventivo
 *  dichiara una cosa sola, e per sempre — niente mesi, niente scadenza della
 *  copertura: **dal secondo impianto in poi** quel cliente paga quel prezzo.
 *
 *  ── DUE PROMOZIONI CHE NON SI MESCOLANO ──────────────────────────────────
 *  ⚠️ I codici della video testimonianza e quelli della garanzia restano DUE
 *   cose separate, e si vedono come due voci distinte sul preventivo. Non è una
 *   questione di ordine: uno toglie euro dal totale di OGGI, l'altro fissa il
 *   prezzo di un acquisto FUTURO. Sommarli in una riga sola vorrebbe dire un
 *   documento in cui non si capisce più cosa è stato scontato — e quando il
 *   cliente torna fra un anno con quel foglio in mano, non lo sa più nessuno.
 *
 *  ── PERCHÉ IL SECONDO COSTA MENO, DETTO AL CLIENTE ───────────────────────
 *  Tre quarti del lavoro di un impianto sono progettazione e studio sulla
 *  persona: attaccatura, densità, direzione, colore, misure della calotta.
 *  Quel lavoro si fa UNA volta e resta: dal secondo in poi si parte dal suo
 *  progetto, e il prezzo lo dice. È il senso di `DISCLAIMER_SECONDO`.
 *
 *  ⚠️ QUESTO FILE NON DISEGNA NIENTE E NON LEGGE NIENTE: prende i numeri e
 *   risponde. È la condizione per provarlo senza aprire un browser, ed è
 *   l'unico modo di essere sicuri che due schermate diverse — il preventivo del
 *   consulente e quello del cliente — facciano lo stesso conto.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { GaranziaCodice } from "./garanzia-codici";

/** Come si esprime l'offerta: una cifra fissa, o una percentuale sul prezzo. */
export type TipoOfferta = "fisso" | "percento";

/** ── CHE TIPO DI OFFERTA È ────────────────────────────────────────────────
 *  La percentuale vince quando c'è: è il campo nuovo, e un codice che ha tutti
 *  e due è un codice che qualcuno ha modificato — l'ultima cosa scritta è
 *  quella che voleva. `null` = questo codice non porta nessuna offerta. */
export function tipoOfferta(g: GaranziaCodice | null | undefined): TipoOfferta | null {
  if (!g || g.mostra === false) return null;
  if (Number(g.sconto) > 0) return "percento";
  if (Number(g.importo) > 0) return "fisso";
  return null;
}

/** C'è un'offerta sulla garanzia in questo codice? */
export function offertaDelCodice(g: GaranziaCodice | null | undefined): GaranziaCodice | null {
  return tipoOfferta(g) ? (g as GaranziaCodice) : null;
}

/** ── QUANTO COSTERÀ IL SECONDO IMPIANTO ───────────────────────────────────
 *  Ritorna il prezzo e quanto si risparmia rispetto a quello di oggi.
 *  ⚠️ Si arrotonda al centesimo: questa cifra finisce su un documento e in una
 *   conversazione, e sei decimali sono un errore che si vede.
 *  ⚠️ E non scende mai sotto zero: una percentuale sbagliata non deve poter
 *   produrre un prezzo negativo, cioè la promessa di ridare dei soldi. */
export function prezzoDalSecondo(p: {
  /** Il prezzo pieno di oggi, su cui si calcola la percentuale. */
  pieno: number;
  offerta?: GaranziaCodice | null;
}): { prezzo: number; risparmio: number; percento: number } | null {
  const tipo = tipoOfferta(p.offerta);
  if (!tipo) return null;
  const pieno = Math.max(0, Number(p.pieno) || 0);
  const cent = (n: number) => Math.round(n * 100) / 100;
  if (tipo === "fisso") {
    const prezzo = cent(Math.max(0, Number(p.offerta?.importo) || 0));
    return {
      prezzo,
      risparmio: cent(Math.max(0, pieno - prezzo)),
      percento: pieno > 0 ? Math.round(((pieno - prezzo) / pieno) * 100) : 0,
    };
  }
  const pct = Math.min(100, Math.max(0, Number(p.offerta?.sconto) || 0));
  const risparmio = cent((pieno * pct) / 100);
  return { prezzo: cent(Math.max(0, pieno - risparmio)), risparmio, percento: Math.round(pct) };
}

/** ── PERCHÉ IL SECONDO COSTA MENO ─────────────────────────────────────────
 *  Richiesta del committente: «spiega con disclaimer perché accade, e il motivo
 *  è che 3/4 del tempo viene impiegato per la progettazione e lo studio
 *  dell'impianto sulla persona, questo permette di ottenere questo prezzo per i
 *  successivi».
 *  ⚠️ NON È UNO SLOGAN, ED È PER QUESTO CHE FUNZIONA: dice una cosa verificabile
 *   («il progetto resta nostro e resta suo») e spiega il prezzo invece di
 *   annunciarlo. Un prezzo più basso senza una ragione si legge come «allora il
 *   primo me l'avete fatto pagare troppo»; con la ragione, si legge come il
 *   motivo per restare. */
export const DISCLAIMER_SECONDO_FISSO =
  "Due cose rendono possibile questo prezzo. La prima è che il grosso del lavoro su di te è già fatto: attaccatura, densità, direzione e misure della calotta si studiano una volta sola, e dal secondo impianto resta la lavorazione. La seconda è che il laboratorio ci riconosce condizioni migliori se chiudiamo 25 impianti entro 14 giorni — e quel vantaggio lo giriamo a te, finché la finestra è aperta.";

/** ── E QUELLA PER LA PERCENTUALE ──────────────────────────────────────────
 *  Solo la prima ragione, per decisione del committente. Ed è coerente: la
 *  seconda parla di una finestra che si chiude — 25 impianti in 14 giorni — e
 *  quella spiega un prezzo FISSO messo lì adesso. Una percentuale è una
 *  condizione che si tiene nel tempo: appiccicarle sopra un'urgenza che non
 *  c'entra vorrebbe dire prometterne la scadenza senza averla. */
export const DISCLAIMER_SECONDO_PERCENTO =
  "Il grosso del lavoro su di te è già fatto: attaccatura, densità, direzione e misure della calotta si studiano una volta sola, e dal secondo impianto resta la lavorazione.";

/** Quale delle due spiegazioni va con questa offerta. */
export function disclaimerDi(g: GaranziaCodice | null | undefined): string {
  return tipoOfferta(g) === "percento" ? DISCLAIMER_SECONDO_PERCENTO : DISCLAIMER_SECONDO_FISSO;
}

/** ── I POSTI, DETTI COME LI DICE CHI VENDE ────────────────────────────────
 *  Richiesta del committente: «fai che i posti siano 9/12 occupati, ne
 *  rimangono 3 — ma scrivi in modo professionale, usa però questa formula».
 *  ⚠️ PERCHÉ FUNZIONA MEGLIO DI «RESTANO 3»: un numero solo non dice niente
 *   («3 su quanti? su mille?»), mentre 9 su 12 racconta che la maggior parte è
 *   già andata — e lo dimostra invece di affermarlo. È la stessa cifra letta
 *   dalla parte giusta.
 *  ⚠️ E senza il totale NON si inventa: si dice quello che si sa. */
export function postiInParole(g: GaranziaCodice | null | undefined): string {
  const o = offertaDelCodice(g);
  if (!o) return "";
  const restano = Number(o.posti);
  if (!Number.isFinite(restano) || restano <= 0) return "";
  const totali = Number(o.postiTotali);
  if (!Number.isFinite(totali) || totali < restano) {
    return restano === 1 ? "resta 1 posto" : `restano ${restano} posti`;
  }
  const presi = totali - restano;
  const quanti = restano === 1 ? "ne resta 1" : `ne restano ${restano}`;
  return `${presi} di ${totali} posti già assegnati · ${quanti}`;
}

/** Quanta parte dei posti è già andata, da 0 a 1: serve alla barra che lo
 *  mostra invece di dirlo. `null` quando i posti non si sanno. */
export function quotaPostiPresi(g: GaranziaCodice | null | undefined): number | null {
  const o = offertaDelCodice(g);
  if (!o) return null;
  const restano = Number(o.posti);
  const totali = Number(o.postiTotali);
  if (!Number.isFinite(restano) || !Number.isFinite(totali) || totali <= 0 || restano < 0) return null;
  return Math.min(1, Math.max(0, (totali - restano) / totali));
}

export function limiteInParole(
  g: GaranziaCodice | null | undefined,
  oggi: Date = new Date(),
): string {
  const o = offertaDelCodice(g);
  if (!o) return "";
  const pezzi: string[] = [];
  const posti = postiInParole(o);
  if (posti) pezzi.push(posti);
  const scad = giornoDellaScadenza(scadenzaEffettiva(o, oggi), oggi);
  if (scad) pezzi.push(`valida fino al ${scad}`);
  return pezzi.join(" · ");
}

/** ── QUANDO SCADE DAVVERO QUESTA OFFERTA ──────────────────────────────────
 *  Due modi di dirlo, e uno vince: «entro N giorni» (dinamica) batte la data
 *  fissa, perché è quella che fa vivere la promo senza spostarla a mano.
 *  ⚠️ `da` È IL GIORNO DA CUI SI CONTA: mentre si compila è OGGI, ma su un
 *   preventivo già creato è il giorno in cui È NATO. Così la data scritta su
 *   quel documento resta quella e non invecchia ogni volta che lo si riapre —
 *   che sarebbe il modo più rapido di far sembrare finta una scadenza vera. */
export function scadenzaEffettiva(
  g: GaranziaCodice | null | undefined,
  da: Date = new Date(),
): string {
  if (!g) return "";
  const giorni = Number(g.giorni);
  if (Number.isFinite(giorni) && giorni > 0) {
    const d = new Date(da.getTime());
    d.setDate(d.getDate() + Math.round(giorni));
    //  Si scrive con i numeri locali, non con toISOString: quello passa per UTC
    //  e in Italia, di sera, sposta la scadenza al giorno prima.
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const gg = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${gg}`;
  }
  const fissa = String(g.scadenza || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fissa) ? fissa : "";
}

/** Il giorno della scadenza come si dice a voce («5 ottobre»), o "" se non c'è
 *  o se è già passata: un'offerta scaduta non si annuncia, si toglie. */
export function giornoDellaScadenza(iso: string | undefined, oggi: Date = new Date()): string {
  const g = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return "";
  //  Fine giornata: un'offerta «fino al 5» vale tutto il 5.
  const fine = new Date(`${g}T23:59:59`);
  if (Number.isNaN(fine.getTime()) || fine.getTime() < oggi.getTime()) return "";
  return fine.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

/** ── LA DATA COME SI DICE A VOCE, CON IL GIORNO DELLA SETTIMANA ───────────
 *  «mercoledì 8 ottobre». Il giorno della settimana non è un ornamento: con
 *  quello la scadenza smette di essere un'insegna e diventa una data
 *  d'agenda — si capisce quanto tempo c'è senza doverlo contare.
 *  ⚠️ In italiano il mese resta minuscolo: si alza solo la prima lettera. */
export function giornoEsteso(iso: string | undefined, oggi: Date = new Date()): string {
  const g = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return "";
  const fine = new Date(`${g}T23:59:59`);
  if (Number.isNaN(fine.getTime()) || fine.getTime() < oggi.getTime()) return "";
  const t = fine.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** L'offerta è ancora valida? Serve a non mostrare un prezzo che non si può
 *  più dare: posti finiti o data passata. */
export function offertaValida(
  g: GaranziaCodice | null | undefined,
  oggi: Date = new Date(),
): boolean {
  const o = offertaDelCodice(g);
  if (!o) return false;
  const posti = Number(o.posti);
  if (Number.isFinite(posti) && posti <= 0) return false;
  const quando = scadenzaEffettiva(o, oggi);
  if (quando && !giornoDellaScadenza(quando, oggi)) return false;
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHE COSA HO APPENA APPLICATO — la riga che compare sotto il codice
   ───────────────────────────────────────────────────────────────────────────
   ⚠️ E DICE DI QUALE DELLE DUE PROMOZIONI SI TRATTA. Sono due cose diverse —
    una toglie euro dal totale di oggi, l'altra fissa il prezzo del secondo
    impianto — e una riga che le chiama con lo stesso nome è una riga che, fra
    un anno, non permette più a nessuno di sapere cosa era stato promesso.
   ═══════════════════════════════════════════════════════════════════════════ */

const euro = (n: number): string =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function frasiCodiceApplicato(p: {
  codice: string;
  /** Quanto toglie dal totale di oggi (video testimonianza). */
  sconto?: number;
  /** L'offerta sul secondo impianto, se il codice ne porta una. */
  offerta?: GaranziaCodice | null;
  /** Il prezzo pieno di oggi, per calcolare la percentuale. */
  pieno?: number;
  /** Il messaggio scritto a mano da chi ha creato il codice: vince su tutto. */
  suo?: string | null;
  oggi?: Date;
}): string {
  const suo = String(p.suo || "").trim();
  if (suo) return suo;
  const codice = String(p.codice || "").trim().toUpperCase();
  const parti: string[] = [];
  const sconto = Number(p.sconto) || 0;
  if (sconto > 0) parti.push(`${euro(sconto)} in meno sul totale`);
  const secondo = prezzoDalSecondo({ pieno: Number(p.pieno) || 0, offerta: p.offerta });
  if (secondo) parti.push(`dal secondo impianto ${euro(secondo.prezzo)}`);
  if (!parti.length) return codice ? `Codice ${codice} applicato.` : "Codice applicato.";
  const testa = codice ? `Codice ${codice} applicato: ` : "";
  const corpo = parti.length === 2 ? `${parti[0]} e ${parti[1]}` : parti[0];
  const limite = limiteInParole(p.offerta, p.oggi ?? new Date());
  return `${testa}${corpo}.${limite ? ` ${limite.charAt(0).toUpperCase()}${limite.slice(1)}.` : ""}`;
}
