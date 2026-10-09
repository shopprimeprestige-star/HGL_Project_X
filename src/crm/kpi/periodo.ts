// ── IL PERIODO E LE QUATTRO SCHEDE DI /CRM/kpi ──────────────────────────────
//  Questo file è l'unico posto dove è scritto QUALI schede esistono e QUALI
//  periodi si possono scegliere. Lo leggono il contenitore (routes/CRM.kpi.tsx)
//  e lo smistamento delle schede (routes/CRM.kpi.index.tsx).
//
//  ── QUATTRO SCHEDE, QUATTRO DOMANDE ───────────────────────────────────────
//  Ogni scheda risponde a UNA domanda e ha UN numero principale:
//   · ritorno    → «quanto rende quello che spendo»  → costo per cliente
//   · fonti      → «da dove arrivano i clienti buoni» → conversione totale
//   · chiamate   → «quante telefonate diventano appuntamenti» → appuntamenti
//                   ogni 100 chiamate
//   · consulenti → «chi sta lavorando meglio» → chiusura sulle consulenze
//
//  ⚠️ NON c'è più una scheda «da fare»: la coda del lavoro non è un numero e
//  non sta in una pagina di analisi. È tornata una voce di menu sua, su
//  /CRM/avanzamento (dov'è sempre stata, ed è dove puntano il menu, la pagina
//  iniziale e la ricerca ⌘K).
//  ⚠️ NON c'è più «KPI manuale»: registrare la spesa è un GESTO e vive dentro
//  «Ritorno», nel registro della spesa. Il vecchio indirizzo reindirizza qui.
//
//  PERCHÉ IL PERIODO STA NELL'INDIRIZZO E NON IN UNO useState
//  Nell'indirizzo il periodo è uno solo, sopravvive al ricaricamento e si può
//  incollare a un collega. Due schede della stessa pagina che rispondono su
//  finestre diverse si contraddicono e non si sa a quale credere.
import type { Intervallo } from "@/crm/kpi-calcoli";

/** Le schede di KPI. "ritorno" è quella che si apre da sola e non compare
 *  nell'indirizzo: un indirizzo pulito è quello che si condivide. */
export type SchedaKpi = "ritorno" | "fonti" | "chiamate" | "consulenti";

/** Cosa può esserci nell'indirizzo di /CRM/kpi. Entrambi i campi sono
 *  FACOLTATIVI di proposito: un link scritto altrove nel CRM (menu, ricerca
 *  ⌘K, pagina iniziale) deve continuare a puntare a "/CRM/kpi" senza dover
 *  conoscere questi parametri. */
export interface RicercaKpi {
  scheda?: SchedaKpi;
  periodo?: Intervallo;
}

const SCHEDE_VALIDE: SchedaKpi[] = ["ritorno", "fonti", "chiamate", "consulenti"];

/** ── I NOMI VECCHI CHE GIRANO NEI PREFERITI ────────────────────────────────
 *  Le schede si chiamavano «panoramica» e «telefono». Un indirizzo salvato che
 *  smette di funzionare non sembra spostato, sembra rotto: si traduce invece di
 *  scartarlo. «da-fare» non è qui perché non ha più una scheda dove atterrare —
 *  chi ci arriva vede «Ritorno», e la coda del lavoro sta su /CRM/avanzamento. */
const NOMI_VECCHI: Record<string, SchedaKpi> = {
  panoramica: "ritorno",
  telefono: "chiamate",
};

const PERIODI_VALIDI: Intervallo[] = ["oggi", "ieri", "3", "7", "15", "30", "60", "90", "tutto"];

/** Il periodo con cui si apre la pagina quando l'indirizzo non ne porta uno.
 *  Trenta giorni è la finestra che usavano già sia KPI sia KPI manuale. */
export const PERIODO_PREDEFINITO: Intervallo = "30";

/** La scheda con cui si apre la pagina: quella dei soldi, che è la domanda del
 *  titolare — il primo a cui serve questa schermata. */
export const SCHEDA_PREDEFINITA: SchedaKpi = "ritorno";

/** Gli stessi nove intervalli in tutte le schede, nello stesso ordine: due
 *  schede sorelle che chiamano "30 giorni" due finestre diverse producono due
 *  verità e si finisce a non credere a nessuna delle due. */
export const INTERVALLI: { v: Intervallo; t: string }[] = [
  { v: "oggi", t: "Oggi" },
  { v: "ieri", t: "Ieri" },
  { v: "3", t: "3 giorni" },
  { v: "7", t: "7 giorni" },
  { v: "15", t: "15 giorni" },
  { v: "30", t: "30 giorni" },
  { v: "60", t: "60 giorni" },
  { v: "90", t: "90 giorni" },
  { v: "tutto", t: "Tutto" },
];

/** ── LEGGERE L'INDIRIZZO SENZA FIDARSENE ───────────────────────────────────
 *  Quello che arriva dalla barra degli indirizzi è testo scritto da chiunque:
 *  un `?periodo=45` o un `?scheda=pippo` non devono lasciare la pagina bianca
 *  né far calcolare una finestra che non esiste. Ciò che non è riconosciuto
 *  viene semplicemente dimenticato, e la pagina si apre sul valore di partenza. */
export function leggiRicercaKpi(raw: Record<string, unknown>): RicercaKpi {
  const grezza = typeof raw.scheda === "string" ? raw.scheda : "";
  const scheda = SCHEDE_VALIDE.find((s) => s === grezza) ?? NOMI_VECCHI[grezza];
  const periodo = PERIODI_VALIDI.find((p) => p === raw.periodo);
  const out: RicercaKpi = {};
  //  La scheda predefinita non si scrive nell'indirizzo: tenerla fuori evita
  //  due indirizzi diversi per la stessa schermata.
  if (scheda && scheda !== SCHEDA_PREDEFINITA) out.scheda = scheda;
  if (periodo) out.periodo = periodo;
  return out;
}

/** Il periodo effettivo: quello dell'indirizzo, o il predefinito. Una funzione
 *  sola perché ogni scheda deve arrivare allo stesso valore anche quando
 *  l'indirizzo non dice niente. */
export function periodoDi(ricerca: RicercaKpi): Intervallo {
  return ricerca.periodo ?? PERIODO_PREDEFINITO;
}

/** La scheda effettiva, con la stessa regola del periodo. */
export function schedaDi(ricerca: RicercaKpi): SchedaKpi {
  return ricerca.scheda ?? SCHEDA_PREDEFINITA;
}
