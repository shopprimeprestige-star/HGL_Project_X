/** ── IL FOGLIO DELLE INSTALLAZIONI, LETTO E RISCRITTO ──────────────────────
 *
 *  Il committente tiene (teneva) le pose su un foglio di calcolo: nome,
 *  telefono, quanto ha pagato, il modello, due note e — quando c'è — il giorno
 *  del montaggio. Qui quel foglio si importa.
 *
 *  ── ⚠️ LE COLONNE NON SI POSSONO CREDERE ─────────────────────────────────
 *  MISURATO sul foglio vero, non supposto: l'intestazione dichiara otto
 *  colonne, ma la data dell'installazione compare nella settima riga su una
 *  riga, nella tredicesima su un'altra, e in mezzo ci sono sette colonne senza
 *  nome usate come viene. Un lettore che si fida della posizione importa
 *  l'indirizzo dentro la data e il prezzo dentro le note.
 *  Perciò qui si guarda COSA C'È SCRITTO in ogni cella: una data ha la forma
 *  di una data, un telefono ha otto cifre, un'email ha la chiocciola. Solo il
 *  NOME si prende per posizione (è sempre il primo), perché un nome non ha
 *  nessuna forma che lo distingua da una nota.
 *
 *  ── ⚠️ QUELLO CHE NON SI CAPISCE SI DICE ─────────────────────────────────
 *  «589 forse 650», «589 - sconto 550 - 300 carta», «50 + 350»: un foglio
 *  scritto a mano da persone è pieno di frasi che un numero non lo contengono,
 *  lo raccontano. Qui si prende la lettura più probabile e si ALZA UNA MANO —
 *  `dubbi` — invece di importare in silenzio una cifra inventata. Chi importa
 *  vede la riga segnata e decide lui.
 */

/* ── 1. IL CSV, LETTO COME SI DEVE ────────────────────────────────────────── */

/** ⚠️ Un `split(",")` NON basta, e su questo foglio si rompe subito: dentro le
 *  celle ci sono virgole («0,03» è uno spessore), virgolette e perfino A CAPO
 *  — una nota lunga tre righe dentro una cella sola. Questo è un lettore vero:
 *  legge carattere per carattere e sa quando è dentro le virgolette. */
export function leggiCsv(testo: string): string[][] {
  const s = String(testo ?? "").replace(/^﻿/, "");
  const righe: string[][] = [];
  let riga: string[] = [];
  let cella = "";
  let dentro = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (dentro) {
      if (c === '"') {
        //  Due virgolette di fila, dentro le virgolette, sono UNA virgoletta.
        if (s[i + 1] === '"') {
          cella += '"';
          i += 1;
        } else dentro = false;
      } else cella += c;
      continue;
    }
    if (c === '"') {
      dentro = true;
    } else if (c === ",") {
      riga.push(cella);
      cella = "";
    } else if (c === "\n" || c === "\r") {
      //  \r\n conta come un a capo solo.
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      riga.push(cella);
      righe.push(riga);
      riga = [];
      cella = "";
    } else cella += c;
  }
  if (cella || riga.length) {
    riga.push(cella);
    righe.push(riga);
  }
  return righe;
}

/** Il contrario: una riga di CSV scritta come si deve. */
export function scriviCella(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const scriviCsv = (righe: unknown[][]): string =>
  righe.map((r) => r.map(scriviCella).join(",")).join("\n");

/* ── 2. LEGGERE UNA CELLA PER QUELLO CHE È ────────────────────────────────── */

const pulito = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();

/** Le cifre di un possibile telefono. ⚠️ Almeno otto: «0,03» è uno spessore e
 *  «20» un prezzo, e presi per telefono farebbero nascere schede fantasma. */
export function telefonoDaCella(v: string): string {
  const s = pulito(v).replace(/[‪-‮⁦-⁩]/g, "");
  if (/[a-zA-Z]{3}/.test(s)) return ""; // «comunicato nuovo prezzo» non è un numero
  const cifre = s.replace(/\D/g, "");
  if (cifre.length < 8 || cifre.length > 15) return "";
  return s;
}

const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
export const emailDaCella = (v: string): string => RE_EMAIL.exec(pulito(v))?.[0]?.toLowerCase() ?? "";

/** ── UNA DATA, COME LA SCRIVONO LE PERSONE ────────────────────────────────
 *  «19/04/26», «03/05/26», «27.11.05», «16/03/26». ⚠️ Due cifre d'anno: «26» è
 *  il 2026, non il 1926 — un foglio di lavoro parla di adesso. E il giorno
 *  viene PRIMA del mese: è un foglio italiano, e leggerlo all'americana
 *  sposterebbe metà delle pose di mesi interi.
 */
export function dataDaCella(v: string, annoBase = 2000): string {
  const m = /(^|[^\d])(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})([^\d]|$)/.exec(pulito(v));
  if (!m) return "";
  const g = Number(m[2]);
  const me = Number(m[3]);
  let a = Number(m[4]);
  if (a < 100) a += annoBase;
  if (g < 1 || g > 31 || me < 1 || me > 12 || a < 2000 || a > 2100) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  const iso = `${a}-${p(me)}-${p(g)}`;
  //  Una data che il calendario non ha (31 febbraio) non si importa: meglio
  //  niente che un appuntamento in un giorno che non esiste.
  const prova = new Date(`${iso}T12:00:00`);
  return prova.getMonth() + 1 === me && prova.getDate() === g ? iso : "";
}

/** «alle 10:00», «Ore 12:00», «14:00». */
export function oraDaCella(v: string): string {
  //  ⚠️ SOLO I DUE PUNTI. Accettando anche il punto, «27.11.05» — che è una
  //   data — veniva letto come le 11:05: la posa finiva in agenda a un orario
  //   che nessuno aveva mai detto. Sul foglio vero gli orari si scrivono tutti
  //   con i due punti.
  const m = /(^|[^\d])([01]?\d|2[0-3]):([0-5]\d)([^\d]|$)/.exec(pulito(v));
  if (!m) return "";
  return `${String(Number(m[2])).padStart(2, "0")}:${m[3]}`;
}

/** ── I SOLDI, SCRITTI COME CAPITA ─────────────────────────────────────────
 *  «€589», «589», «350€», «€1.100», «50 + 350», «289 x2», «€369 - ora €219»,
 *  «589 forse 650», «589 - sconto 550 - 300 carta».
 *  Le regole, in ordine, e ognuna nasce da una riga vera del foglio:
 *   · «ora <cifra>» → vince l'ultima, è il prezzo aggiornato;
 *   · «a + b» → la somma, sono due versamenti;
 *   · «a x2» → il doppio, sono due impianti;
 *   · altrimenti il PRIMO numero, che è quello che la riga sta dichiarando.
 *  ⚠️ E se restano altri numeri, o compaiono parole come «forse» e «sconto»,
 *   si alza la mano: il numero giusto lì dentro non lo sa nemmeno chi l'ha
 *   scritto, e importarlo in silenzio vuol dire fatturare la cifra sbagliata.
 */
export function soldiDaCella(v: string): { valore: number; dubbio: boolean } {
  const s = pulito(v).replace(/ /g, " ");
  if (!s) return { valore: 0, dubbio: false };
  //  I numeri: si accettano 1.100 (migliaia) e 1100.
  const numeri = (s.match(/\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?/g) ?? []).map((n) =>
    Number(n.replace(/\./g, "").replace(",", ".")),
  );
  const buoni = numeri.filter((n) => Number.isFinite(n) && n > 0);
  if (buoni.length === 0) return { valore: 0, dubbio: /\D/.test(s) && s.length > 0 };

  const parole = /forse|sconto|circa|oppure|\?/i.test(s);
  const ora = /\bora\b\s*€?\s*(\d{1,3}(?:\.\d{3})+|\d+)/i.exec(s);
  if (ora) return { valore: Number(ora[1].replace(/\./g, "")), dubbio: parole };
  if (/\+/.test(s) && buoni.length > 1) {
    return { valore: buoni.reduce((a, b) => a + b, 0), dubbio: parole };
  }
  const per = /x\s*(\d)/i.exec(s);
  if (per && buoni.length >= 1) return { valore: buoni[0] * Number(per[1]), dubbio: parole };
  return { valore: buoni[0], dubbio: parole || buoni.length > 1 };
}

/* ── 3. UNA RIGA DEL FOGLIO ───────────────────────────────────────────────── */

export interface RigaImportata {
  nome: string;
  telefono: string;
  email: string;
  /** quanto ha già versato */
  pagato: number;
  /** il prezzo della pratica */
  totale: number;
  /** "2026-04-19" quando il foglio lo dice */
  dataInstallazione: string;
  ora: string;
  /** tutto il resto, di seguito: modello, misure, appunti */
  note: string;
  /** cosa non si è capito: si mostra a chi importa, non si nasconde */
  dubbi: string[];
}

/** Quali colonne portano i soldi. ⚠️ Sono le uniche due prese per POSIZIONE
 *  oltre al nome, e per un motivo: «100» e «589» hanno la stessa forma, e solo
 *  la colonna dice quale delle due è l'acconto. Se l'intestazione non c'è si
 *  ripiega su queste, che sono quelle del foglio vero. */
const COL_PAGATO = 3;
const COL_TOTALE = 4;

export function interpretaRiga(celle: string[], annoBase = 2000): RigaImportata | null {
  const nome = pulito(celle[0]);
  //  Una riga senza nome non è una pratica: nel foglio vero sono le righe
  //  vuote che separano i blocchi.
  if (!nome || /^nome/i.test(nome)) return null;

  const dubbi: string[] = [];
  const usate = new Set<number>([0]);

  let telefono = "";
  let email = "";
  for (let i = 1; i < celle.length; i += 1) {
    const c = pulito(celle[i]);
    if (!c) continue;
    if (!email) {
      const e = emailDaCella(c);
      if (e) {
        email = e;
        usate.add(i);
        continue;
      }
    }
    if (!telefono && i <= 2) {
      const t = telefonoDaCella(c);
      if (t) {
        telefono = t;
        usate.add(i);
      }
    }
  }

  const pag = soldiDaCella(celle[COL_PAGATO] ?? "");
  const tot = soldiDaCella(celle[COL_TOTALE] ?? "");
  if (pulito(celle[COL_PAGATO] ?? "")) usate.add(COL_PAGATO);
  if (pulito(celle[COL_TOTALE] ?? "")) usate.add(COL_TOTALE);
  if (pag.dubbio) dubbi.push(`acconto da controllare: «${pulito(celle[COL_PAGATO])}»`);
  if (tot.dubbio) dubbi.push(`prezzo da controllare: «${pulito(celle[COL_TOTALE])}»`);
  //  ⚠️ Pagato più del prezzo: quasi sempre è il prezzo scritto male, e
  //   importarlo in silenzio farebbe risultare un credito che non c'è.
  if (tot.valore > 0 && pag.valore > tot.valore) {
    dubbi.push("risulta pagato più del prezzo: controlla le due cifre");
  }

  let dataInstallazione = "";
  let ora = "";
  for (let i = 1; i < celle.length; i += 1) {
    if (usate.has(i)) continue;
    const c = pulito(celle[i]);
    if (!c) continue;
    if (!dataInstallazione) {
      const d = dataDaCella(c, annoBase);
      if (d) {
        dataInstallazione = d;
        usate.add(i);
        //  L'ora è spesso nella stessa cella («27.11.05 - Ore 12:00»).
        const o = oraDaCella(c);
        if (o) ora = o;
        continue;
      }
    }
    if (!ora) {
      const o = oraDaCella(c);
      //  ⚠️ Solo se la cella è POCO più di un orario: dentro una nota lunga
      //   «alle 15:30» è un appunto, non il momento della posa.
      if (o && c.length <= 16) {
        ora = o;
        usate.add(i);
      }
    }
  }

  /** ⚠️ Una data di anni fa quasi sempre è un anno battuto male — «27.11.05»
   *  per «27.11.25» — e importata in silenzio mette una posa nel passato, dove
   *  nessuno la guarda più. Si importa lo stesso (potrebbe essere un lavoro
   *  vecchio davvero) ma si alza la mano. */
  if (dataInstallazione && dataInstallazione < `${new Date().getFullYear() - 1}-01-01`) {
    dubbi.push(`la data risulta ${dataInstallazione}: controlla l'anno`);
  }

  const note = celle
    .map((c, i) => (usate.has(i) ? "" : pulito(c)))
    .filter(Boolean)
    .join(" · ");

  return { nome, telefono, email, pagato: pag.valore, totale: tot.valore, dataInstallazione, ora, note, dubbi };
}

export interface EsitoImporto {
  righe: RigaImportata[];
  /** righe saltate perché non erano pratiche (vuote, intestazioni) */
  saltate: number;
}

export function importaCsv(testo: string, annoBase = 2000): EsitoImporto {
  const righe = leggiCsv(testo);
  const fuori: RigaImportata[] = [];
  let saltate = 0;
  righe.forEach((r, i) => {
    //  La prima riga è l'intestazione se comincia con «Nome».
    if (i === 0 && /^nome/i.test(pulito(r[0]))) return;
    const letta = interpretaRiga(r, annoBase);
    if (letta) fuori.push(letta);
    else saltate += 1;
  });
  return { righe: fuori, saltate };
}

/* ── 4. E IL FOGLIO SI RISCRIVE ───────────────────────────────────────────── */

export const INTESTAZIONE_CSV = [
  "Nome e Cognome",
  "Telefono",
  "E-mail",
  "Pagato",
  "Importo Totale",
  "Data installazione",
  "Ora",
  "Note",
];

/** Il foglio da scaricare. ⚠️ Le stesse colonne che si sanno leggere: un
 *  export che esce in una forma che l'import non riconosce è un viaggio di
 *  sola andata, e ci si accorge del guaio quando si prova a rimetterlo dentro. */
export function esportaCsv(
  righe: { nome: string; telefono?: string; email?: string; pagato?: number; totale?: number; data?: string; ora?: string; note?: string }[],
): string {
  return scriviCsv([
    INTESTAZIONE_CSV,
    ...righe.map((r) => [
      r.nome,
      r.telefono ?? "",
      r.email ?? "",
      r.pagato ? String(r.pagato) : "",
      r.totale ? String(r.totale) : "",
      r.data ?? "",
      r.ora ?? "",
      r.note ?? "",
    ]),
  ]);
}
