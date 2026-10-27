/** ── PRENOTA IN CHAT: I TESTI ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (SPEC 2, 3.7, 3.8). TUTTE le frasi che il CRM scrive al
 *  lead stanno in questo file, e si possono cambiare qui: il titolare le legge
 *  e le corregge senza toccare la logica. Sono messaggi di servizio dentro la
 *  finestra delle 24 ore (il lead ha appena scritto o toccato un pulsante),
 *  non modelli Meta.
 *
 *  Tutte pure, `(dati) => string`. Forma di cortesia («Lei»), frasi corte.
 *
 *  ⚠️ Dal lead esce SOLO il nome di battesimo (7.2): mai cognome, telefono,
 *   note, id. Le funzioni leggono solo i campi che servono, quindi anche una
 *   scheda intera passata per sbaglio non fa uscire altro.
 *  ⚠️ Lunghezza: i messaggi con pulsanti ammettono 1024 caratteri, qui si resta
 *   sotto i 900. Per questo i nomi sono tagliati a 30 lettere: l'unica cosa di
 *   lunghezza libera, oltre al link, che è del sistema.
 *  ⚠️ Il link della stanza sta in una riga a sé: un punto attaccato rischia di
 *   finire dentro l'indirizzo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { giornoParlato, nomePerModello, oraNormale } from "../promemoria/formati";
import { FASCE } from "./prenota-tipi";
import type { DatiAppuntamento, DatiNome, DatiProposte, Fascia, OraProposta } from "./prenota-tipi";

const MASSIMO_NOME = 30;
/** Quanti orari al massimo: i pulsanti «Opzione» in ManyChat sono 3. */
const MASSIMO_OPZIONI = 3;

// ── Pezzi comuni ──────────────────────────────────────────────────────────

/** Il nome di battesimo come entra nel testo: la prima parola, con l'iniziale
 *  maiuscola, solo lettere (con apostrofo e trattino). `""` se non c'è un nome
 *  sensato: un numero, un indirizzo, un'emoji non sono un nome e non entrano. */
function battesimo(grezzo?: string | null): string {
  const prima = (nomePerModello(grezzo) ?? "").split(" ")[0];
  const pulita = prima.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!/^[\p{L}][\p{L}\p{M}'’-]*$/u.test(pulita)) return "";
  const [iniziale, ...resto] = [...pulita.slice(0, MASSIMO_NOME)];
  const coda = resto.join("");
  //  «ANNA» → «Anna»; «D'Angelo» e «McNeil» restano come sono scritti.
  return iniziale.toUpperCase() + (coda === coda.toUpperCase() ? coda.toLowerCase() : coda);
}

const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** «Anna, <frase>» oppure, senza nome, la frase con la maiuscola. La frase si
 *  scrive con la minuscola iniziale. */
function conNome(nome: string, frase: string): string {
  return nome ? `${nome}, ${frase}` : maiuscola(frase);
}

/** «giovedì 29 ottobre alle 18:00». ⚠️ Se la data o l'ora non sono valide si
 *  scrive com'è arrivato: meglio un testo brutto che togliere un'opzione e
 *  sfalsare i numeri dei pulsanti. */
function quando(o: OraProposta | { g: string; o: string }): string {
  return `${giornoParlato(o.g) ?? o.g} alle ${oraNormale(o.o) ?? o.o}`;
}

const SENZA_ORARI =
  "in questi giorni non ho orari liberi online. Un nostro consulente La contatta per trovare insieme l'orario.";

const IN_FASCIA: Record<Fascia, string> = {
  mattina: "di mattina",
  pomeriggio: "del pomeriggio",
  sera: "di sera",
};
const QUELLI_DELLA: Record<Fascia, string> = {
  mattina: "quelli della mattina",
  pomeriggio: "quelli del pomeriggio",
  sera: "quelli della sera",
};

/** In che fascia cade un orario (si guarda l'inizio), `null` se non è un'ora. */
function fasciaDi(ora: string): Fascia | null {
  const n = oraNormale(ora);
  if (!n) return null;
  const minuti = Number(n.slice(0, 2)) * 60 + Number(n.slice(3));
  return (
    (Object.keys(FASCE) as Fascia[]).find((f) => minuti >= FASCE[f].da && minuti <= FASCE[f].a) ??
    null
  );
}

/** La lista degli orari con i numeri dei pulsanti e l'invito a scrivere ALTRI.
 *  Il testo finisce con «Nessuno va bene? Scriva ALTRI», senza punto. */
function elenco(intro: string, proposte: OraProposta[]): string {
  const righe = proposte.slice(0, MASSIMO_OPZIONI).map((p, i) => `Opzione ${i + 1}: ${quando(p)}`);
  return (
    `${intro}\n\n${righe.join("\n")}\n\n` +
    "Tocchi il pulsante dell'opzione che preferisce.\nNessuno va bene? Scriva ALTRI"
  );
}

// ── I messaggi ────────────────────────────────────────────────────────────

/** Le proposte appena calcolate (primo giro e «ALTRI»). Con `ripiego` la fascia
 *  chiesta era vuota: lo dice, e nomina quella da cui vengono gli orari. */
export function testoProposte(d: DatiProposte): string {
  if (d.proposte.length === 0) return testoNessunOrario(d);
  const nome = battesimo(d.nome);
  const effettiva = fasciaDi(d.proposte[0].o);
  if (d.ripiego && d.fasciaChiesta && effettiva) {
    return elenco(
      conNome(
        nome,
        `${IN_FASCIA[d.fasciaChiesta]} non ho orari liberi. Ecco ${QUELLI_DELLA[effettiva]}:`,
      ),
      d.proposte,
    );
  }
  const fascia = d.fasciaChiesta ? ` ${IN_FASCIA[d.fasciaChiesta]}` : "";
  return elenco(
    conNome(nome, `ecco gli orari liberi${fascia} per la consulenza gratuita:`),
    d.proposte,
  );
}

/** La consulenza è fissata. Nomina giorno, ora e consulente e porta SEMPRE il
 *  link della stanza (D13): il messaggio con il modello Meta, che parte dopo,
 *  può non partire. Il link è passato dall'orchestratore; senza, il blocco del
 *  link manca (non c'è niente da inventare). */
export function testoConferma(d: DatiAppuntamento): string {
  const nome = battesimo(d.nome);
  const consulente = battesimo(d.consulente);
  const link = String(d.link ?? "").replace(/[\s\p{Cc}\p{Cf}]/gu, "");
  const con = consulente ? ` con ${consulente}` : "";
  return (
    `${nome ? `Fatto, ${nome}!` : "Fatto!"} La consulenza è fissata per ${quando({ g: d.giorno, o: d.ora })}${con}.\n\n` +
    (link ? `Per collegarsi il giorno della consulenza:\n${link}\n\n` : "") +
    "Le ricorderemo l'appuntamento anche con un messaggio."
  );
}

/** Ha già una consulenza: non si sposta (3.8). Senza link: il link è già partito. */
export function testoGiaFissato(d: DatiAppuntamento): string {
  const consulente = battesimo(d.consulente);
  const con = consulente ? ` con ${consulente}` : "";
  return conNome(
    battesimo(d.nome),
    `ha già una consulenza fissata ${quando({ g: d.giorno, o: d.ora })}${con}. Se vuole cambiarla ci scriva e La aiutiamo.`,
  );
}

/** «Quell'orario è appena stato preso» + le nuove proposte. */
export function testoPreso(d: DatiProposte): string {
  if (d.proposte.length === 0) return testoNessunOrario(d);
  return elenco(
    conNome(battesimo(d.nome), "quell'orario è appena stato preso. Ecco quelli ancora liberi:"),
    d.proposte,
  );
}

/** «Gli orari che Le avevo mandato non sono più validi» + le nuove proposte. */
export function testoVecchia(d: DatiProposte): string {
  if (d.proposte.length === 0) return testoNessunOrario(d);
  return elenco(
    conNome(
      battesimo(d.nome),
      "gli orari che Le avevo mandato non sono più validi. Ecco quelli aggiornati:",
    ),
    d.proposte,
  );
}

export function testoNessunOrario(d: DatiNome): string {
  return conNome(battesimo(d.nome), SENZA_ORARI);
}

/** «ALTRI» ma gli orari liberi sono finiti. */
export function testoAltriFiniti(d: DatiNome): string {
  return conNome(
    battesimo(d.nome),
    "non ho altri orari liberi online in questo periodo. Un nostro consulente La contatta per trovare insieme l'orario.",
  );
}

export function testoErrore(d: DatiNome): string {
  return conNome(
    battesimo(d.nome),
    "non sono riuscito a completare la prenotazione. Un nostro consulente La contatta a breve.",
  );
}

/** «Quell'opzione non c'è» + le stesse proposte. */
export function testoOpzioneNonCe(d: DatiProposte): string {
  if (d.proposte.length === 0) return testoNessunOrario(d);
  return elenco(
    conNome(battesimo(d.nome), "quell'opzione non c'è. Ecco di nuovo gli orari liberi:"),
    d.proposte,
  );
}

/** Il testo che il campo ManyChat ha PRIMA della risposta del CRM (`attesa`):
 *  se la richiesta va in errore o scade, il lead non resta senza parole. */
export function testoAttesa(d?: DatiNome): string {
  return conNome(
    battesimo(d?.nome),
    "un attimo, stiamo controllando gli orari liberi. Se non Le arriva nulla a breve, un nostro consulente La contatta.",
  );
}
