/** ── DOVE VIVONO I CODICI E GLI ORDINI ─────────────────────────────────────
 *
 *  ── ⚠️ IN `app_config`, NON IN DUE TABELLE NUOVE ─────────────────────────
 *  Una tabella vuole una migrazione, e una migrazione vuole qualcuno che la
 *  lanci a mano sul database. In questo progetto è già successo di scriverne
 *  una e ritrovarla non applicata settimane dopo — con la funzione che
 *  aspettava, muta, senza che nessuno sapesse perché non andava.
 *  Qui i codici sono qualche centinaio e gli ordini qualche decina: stanno in
 *  due documenti JSON, si leggono tutti insieme, e la ricerca si fa in memoria
 *  su un elenco che ci sta in una schermata.
 *  ⚠️ IL LIMITE, DETTO: si legge e si riscrive tutto insieme, quindi due
 *   scritture nello stesso istante possono perdersi. Per i codici è quasi
 *   impossibile (li crea una persona sola, dal gestionale); per il CONSUMO di
 *   una prova può capitare, e il peggio che succede è una prova regalata.
 *   Quando i codici saranno migliaia si passa a una tabella vera: le funzioni
 *   qui sotto restano le stesse e cambia solo cosa c'è dentro.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizza, PROVE_COMPRESE } from "./codici";

export const CHIAVE_CODICI = "prova_capelli_codici";
export const CHIAVE_ORDINI = "prova_capelli_ordini";
export const CHIAVE_ANTEPRIME = "prova_capelli_anteprime";

export interface Codice {
  codice: string;
  creatoIl: string;
  /** quante generazioni ha in tutto */
  totali: number;
  usate: number;
  bloccato?: boolean;
  /** ⚠️ Un codice admin può AGGIUNGERE TAGLI al catalogo che vedono tutti.
   *  Costa due generazioni vere e cambia la vetrina: si dà a chi vende, non a
   *  chi prova. Gli altri codici usano i tagli che ci sono e basta. */
  admin?: boolean;
  /** il lead a cui è stato dato, quando c'è */
  leadId?: string;
  /** copiati alla creazione: servono a cercarlo e a precompilare il pagamento
   *  anche il giorno in cui la scheda del lead viene archiviata. */
  nome?: string;
  cognome?: string;
  telefono?: string;
  email?: string;
  /** una riga per ricordarsi perché è stato fatto */
  nota?: string;
  ultimoUso?: string;
  /** ── ⚠️ QUANTO È COSTATO, IN CENTESIMI ──────────────────────────────────
   *  Sui codici admin non c'è un tetto, quindi il freno non è un limite ma un
   *  NUMERO che si vede: quanto ha speso quel codice fino a oggi. Senza, si
   *  scopre l'ammontare guardando la fattura di OpenRouter a fine mese, che è
   *  il momento sbagliato per scoprirlo.
   *  ⚠️ È il costo VERO quando il modello lo dichiara, altrimenti una stima:
   *   meglio un numero dichiarato per quello che è che nessun numero. */
  spesoCentesimi?: number;
  generazioni?: number;
}

export interface Ordine {
  id: string;
  quando: string;
  codice: string;
  pacchetto: string;
  prove: number;
  centesimi: number;
  stato: "in-attesa" | "pagato" | "fallito";
  nome?: string;
  cognome?: string;
  email?: string;
  telefono?: string;
  leadId?: string;
  /** l'identificativo del pagamento presso SumUp */
  riferimento?: string;
}

async function leggi<T>(chiave: string, vuoto: T): Promise<T> {
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", chiave).maybeSingle();
    const v = JSON.parse((data as { value?: string } | null)?.value ?? "null");
    return (v ?? vuoto) as T;
  } catch {
    return vuoto;
  }
}

async function scrivi(chiave: string, valore: unknown): Promise<void> {
  await supabaseAdmin.from("app_config").upsert(
    { key: chiave, value: JSON.stringify(valore), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

/** ── UN'ANTEPRIMA, CON UN NOME PROPRIO ────────────────────────────────────
 *  ⚠️ OGNI PROVA HA UN ID, e finisce nell'indirizzo. Prima l'immagine viveva
 *   solo dentro la scheda del browser: bastava un ricaricamento — o il
 *   telefono che scarica la pagina per fare spazio — e il risultato spariva
 *   senza modo di ritrovarlo. Una prova che si perde è una prova pagata due
 *   volte, e una persona che si arrabbia.
 *  ⚠️ L'immagine salvata è quella GREZZA, senza filigrana: il marchio lo mette
 *   la pagina al momento di mostrarla, e chi ha comprato deve poterla
 *   riscaricare pulita anche domani. */
export interface Anteprima {
  id: string;
  codice: string;
  immagine: string;
  taglio: string;
  colore: string;
  quando: string;
  /** ── ⚠️ LA CONSULENZA IN CUI È NATA ──────────────────────────────────
   *  Il codice di chi conduce è UNO SOLO e resta suo per sempre: senza questo,
   *  «le tue foto» dentro Meetly conteneva le prove di tutti i clienti visti
   *  finora — e il cliente di adesso si vedeva davanti la faccia di quello di
   *  ieri. Con il codice della consulenza, ogni Meetly parte vuoto.
   *  ⚠️ Le prove fatte fuori da una consulenza non ce l'hanno, ed è giusto:
   *   quelle sono del cliente e del suo codice. */
  meet?: string;
  /** ── ⚠️ QUANDO È FINITA SULLA SCHEDA DI UN CLIENTE ────────────────────
   *  Chi lavora con un codice admin fa decine di prove in un giorno, per
   *  persone diverse: la fila delle «tue prove» diventa un mucchio in cui non
   *  si trova più niente. Quando una prova viene mandata sulla scheda di un
   *  lead esce da quella fila — è archiviata, non persa.
   *  ⚠️ Si SEGNA, non si cancella: l'indirizzo `?p=<id>` che il cliente può
   *   avere in mano deve continuare a riaprire la sua immagine. Cancellare la
   *   riga qui vorrebbe dire rompere un link già mandato. */
  inviata?: string;
}

export const tutteLeAnteprime = () => leggi<Anteprima[]>(CHIAVE_ANTEPRIME, []);

export async function salvaAnteprima(a: Anteprima): Promise<Anteprima> {
  const tutte = await tutteLeAnteprime();
  //  ⚠️ Si tiene un tetto: è un documento solo, riletto a ogni prova, e senza
  //   un limite fra un anno pesa dieci megabyte. Le più vecchie escono.
  await scrivi(CHIAVE_ANTEPRIME, [a, ...tutte].slice(0, 4000));
  return a;
}

export const trovaAnteprima = async (id: string): Promise<Anteprima | null> =>
  (await tutteLeAnteprime()).find((a) => a.id === id) ?? null;

export const anteprimeDi = async (
  codice: string,
  opzioni: { meet?: string; incluseInviate?: boolean } = {},
): Promise<Anteprima[]> => {
  const n = normalizza(codice);
  const meet = String(opzioni.meet || "").trim();
  return (await tutteLeAnteprime())
    .filter((a) => normalizza(a.codice) === n)
    //  ⚠️ Dentro una consulenza si vedono SOLO quelle di questa consulenza;
    //   fuori, solo quelle che non appartengono a nessuna. Altrimenti «le tue
    //   foto» diventa l'archivio di tutti i clienti di chi conduce.
    .filter((a) => (meet ? a.meet === meet : !a.meet))
    .filter((a) => opzioni.incluseInviate || !a.inviata);
};

/** ── BUTTARE VIA UNA PROVA ─────────────────────────────────────────────────
 *  Qui si CANCELLA davvero, e non si segna come archiviata: sono due gesti
 *  diversi. «Mandata sulla scheda» vuol dire che la prova è al sicuro
 *  altrove e il link `?p=<id>` deve continuare a funzionare; «elimina» vuol
 *  dire che quella faccia con quel taglio non deve più esistere da nessuna
 *  parte, ed è una richiesta a cui si risponde di sì per intero.
 *
 *  ⚠️ SOLO LE PROVE DEL CODICE CHE LO CHIEDE. L'id da solo non è un permesso:
 *   chi ne indovinasse uno cancellerebbe la prova di un'altra persona. Il
 *   filtro sul codice sta qui dentro e non nella porta, così non può
 *   dimenticarselo nessuno.
 */
export async function eliminaAnteprime(codice: string, ids: string[]): Promise<number> {
  const n = normalizza(codice);
  const insieme = new Set(ids.filter(Boolean));
  if (!n || !insieme.size) return 0;
  const tutte = await tutteLeAnteprime();
  const dopo = tutte.filter((a) => !(insieme.has(a.id) && normalizza(a.codice) === n));
  const tolte = tutte.length - dopo.length;
  if (tolte) await scrivi(CHIAVE_ANTEPRIME, dopo);
  return tolte;
}

/** Segna come archiviate le prove appena finite sulla scheda di un cliente. */
export async function segnaInviate(ids: string[]): Promise<number> {
  const insieme = new Set(ids.filter(Boolean));
  if (!insieme.size) return 0;
  const tutte = await tutteLeAnteprime();
  const quando = new Date().toISOString();
  let toccate = 0;
  const dopo = tutte.map((a) => {
    if (!insieme.has(a.id) || a.inviata) return a;
    toccate += 1;
    return { ...a, inviata: quando };
  });
  if (toccate) await scrivi(CHIAVE_ANTEPRIME, dopo);
  return toccate;
}

export const tuttiICodici = () => leggi<Codice[]>(CHIAVE_CODICI, []);
export const tuttiGliOrdini = () => leggi<Ordine[]>(CHIAVE_ORDINI, []);

/** Il codice, o niente. ⚠️ Si cerca sul NORMALIZZATO: chi lo scrive minuscolo
 *  o senza trattino sta scrivendo lo stesso codice. */
export async function trovaCodice(grezzo: string): Promise<Codice | null> {
  const n = normalizza(grezzo);
  if (!n) return null;
  const tutti = await tuttiICodici();
  return tutti.find((c) => normalizza(c.codice) === n) ?? null;
}

export async function creaCodice(o: Partial<Codice> & { codice: string }): Promise<Codice> {
  const tutti = await tuttiICodici();
  const nuovo: Codice = {
    codice: o.codice,
    creatoIl: new Date().toISOString(),
    totali: Number(o.totali ?? PROVE_COMPRESE),
    usate: 0,
    ...(o.leadId ? { leadId: o.leadId } : {}),
    ...(o.nome ? { nome: o.nome } : {}),
    ...(o.cognome ? { cognome: o.cognome } : {}),
    ...(o.telefono ? { telefono: o.telefono } : {}),
    ...(o.email ? { email: o.email } : {}),
    ...(o.nota ? { nota: o.nota } : {}),
    ...(o.admin ? { admin: true } : {}),
  };
  //  ⚠️ I nuovi vanno in CIMA: nel gestionale si guarda quello appena fatto,
  //   ed è l'unico che si sta per copiare e incollare in una chat.
  await scrivi(CHIAVE_CODICI, [nuovo, ...tutti].slice(0, 5000));
  return nuovo;
}

export async function aggiornaCodice(codice: string, dati: Partial<Codice>): Promise<Codice | null> {
  const n = normalizza(codice);
  const tutti = await tuttiICodici();
  let uscita: Codice | null = null;
  const dopo = tutti.map((c) => {
    if (normalizza(c.codice) !== n) return c;
    uscita = { ...c, ...dati, codice: c.codice, creatoIl: c.creatoIl };
    return uscita;
  });
  if (uscita) await scrivi(CHIAVE_CODICI, dopo);
  return uscita;
}

/** Segna una prova usata. ⚠️ Torna quante ne restano DOPO, così chi chiama non
 *  deve rileggere e non può raccontare un numero diverso da quello vero. */
export async function consumaProva(codice: string, costoCentesimi = 0): Promise<number> {
  const c = await trovaCodice(codice);
  if (!c) return 0;
  const dopo = await aggiornaCodice(codice, {
    usate: Number(c.usate || 0) + 1,
    ultimoUso: new Date().toISOString(),
    generazioni: Number(c.generazioni || 0) + 1,
    spesoCentesimi: Number(c.spesoCentesimi || 0) + Math.max(0, Math.round(costoCentesimi)),
  });
  //  ⚠️ Su un codice admin le prove non si contano: si risponde -1, che la
  //   pagina legge come «illimitate». Restituire un numero che cala darebbe a
  //   chi vende l'impressione di star finendo qualcosa.
  if (dopo?.admin) return -1;
  return Math.max(0, Number(dopo?.totali || 0) - Number(dopo?.usate || 0));
}

export async function aggiungiProve(codice: string, quante: number): Promise<Codice | null> {
  const c = await trovaCodice(codice);
  if (!c) return null;
  //  ⚠️ Si SOMMA al totale e non si azzera l'usato: chi comprava con una prova
  //   ancora in tasca l'avrebbe persa, e se ne sarebbe accorto subito.
  return aggiornaCodice(codice, { totali: Number(c.totali || 0) + Math.max(0, quante) });
}

export async function eliminaCodice(codice: string): Promise<void> {
  const n = normalizza(codice);
  const tutti = await tuttiICodici();
  await scrivi(CHIAVE_CODICI, tutti.filter((c) => normalizza(c.codice) !== n));
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLI ORDINI
   ═════════════════════════════════════════════════════════════════════════ */

export async function creaOrdine(o: Ordine): Promise<Ordine> {
  const tutti = await tuttiGliOrdini();
  await scrivi(CHIAVE_ORDINI, [o, ...tutti].slice(0, 5000));
  return o;
}

export async function aggiornaOrdine(id: string, dati: Partial<Ordine>): Promise<Ordine | null> {
  const tutti = await tuttiGliOrdini();
  let uscita: Ordine | null = null;
  const dopo = tutti.map((x) => {
    if (x.id !== id) return x;
    uscita = { ...x, ...dati, id: x.id, quando: x.quando };
    return uscita;
  });
  if (uscita) await scrivi(CHIAVE_ORDINI, dopo);
  return uscita;
}

export const trovaOrdine = async (id: string): Promise<Ordine | null> =>
  (await tuttiGliOrdini()).find((o) => o.id === id) ?? null;
