/** L'ANTEPRIMA DEL LINK DEL WEBINAR
 *
 *  Il link della sala si manda a decine di persone in una volta, e quasi
 *  sempre su WhatsApp. Finora lì compariva la scheda della VIDEOCONSULENZA —
 *  un'altra cosa, con un'altra promessa — perché l'anteprima del webinar non
 *  era mai stata disegnata.
 *
 *  Il disegno sta in `@/shop/scheda-anteprima`, uguale per tutti i link: qui
 *  ci sono solo le parole, e sono poche di proposito. Chi scorre una chat
 *  legge tre parole, non una frase.
 */
import { depositaScheda, disegnaScheda, COL, type Scheda } from "@/shop/scheda-anteprima";

export interface DatiAnteprimaWebinar {
  /** il codice della sala: è il nome del file depositato */
  codice: string;
  /** il titolo scritto nel CRM — è quello che chi riceve il link legge */
  titolo: string;
  /** quando comincia, in ISO. Vuoto = si parte quando si parte. */
  inizioPrevisto?: string;
}

/** «Gio 10 set · 21:00» — corto, e con il giorno della settimana davanti: è
 *  quello che fa capire «è fra due giorni» senza far contare nessuno. */
export function quandoLeggibile(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const g = d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
  const o = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${g.charAt(0).toUpperCase()}${g.slice(1)} · ${o}`;
}

export function schedaWebinar(d: DatiAnteprimaWebinar): Scheda {
  const data = quandoLeggibile(d.inizioPrevisto);
  return {
    occhiello: "Webinar",
    titolo: String(d.titolo || "").trim() || "Webinar in diretta",
    //  ⚠️ Due frasi diverse, perché sono due momenti diversi: prima conta
    //   sapere che non serve installare niente; a diretta cominciata conta
    //   sapere che si sta perdendo qualcosa adesso.
    sotto: data
      ? "Si entra dal browser, con un tocco. Niente da installare."
      : "È già cominciato: si entra dal browser, con un tocco.",
    //  Le tre domande di chi riceve un link: cos'è, devo installare qualcosa,
    //  posso parlare o guardo e basta.
    pastiglie: [
      { icona: "diretta", testo: "Dal vivo", tinta: COL.diretta },
      { icona: "browser", testo: "Dal browser", tinta: COL.marcaChiara },
      { icona: "chat", testo: "Domande in chat", tinta: "#a78bfa" },
    ],
    invito: "Tocca per entrare",
    //  ⚠️ L'illustrazione della sala: la scheda senza era mezza vuota, e una
    //   metà vuota su un'anteprima si legge come «pagina non finita».
    visuale: "diretta",
    badge: data ? { testo: data, icona: "quando" } : { testo: "IN DIRETTA", acceso: true },
  };
}

export async function disegnaAnteprimaWebinar(tela: HTMLCanvasElement, d: DatiAnteprimaWebinar): Promise<void> {
  await disegnaScheda(tela, schedaWebinar(d));
}

export const depositaAnteprimaWebinar = (d: DatiAnteprimaWebinar): Promise<boolean> =>
  depositaScheda("webinar", d.codice, schedaWebinar(d));
