/** ── CHI COMPARE NELLE PAGINE DELLE INSTALLAZIONI ─────────────────────────
 *  Richiesta del committente, ripetuta due volte e senza eccezioni: nelle
 *  schede che riguardano le pose e i ritorni le pastiglie delle persone devono
 *  mostrare SOLO chi ha la spunta «installatore» o «manutentore». Prima
 *  mostravano l'anagrafica intera — setter, consulenti, chiunque — e su un
 *  elenco di dodici nomi le due o tre persone che entrano davvero in un
 *  magazzino erano da cercare ogni volta.
 *
 *  ⚠️ QUI C'ERANO DUE SCAPPATOIE, E SONO STATE TOLTE ENTRAMBE.
 *  La prima teneva in elenco chi era già scritto su una posa anche senza
 *  spunta; la seconda, se NESSUNO aveva le spunte, mostrava tutti «per non
 *  lasciare la barra vuota». Erano prudenti e sbagliate: la richiesta era
 *  «oltre installatori e manutentori non mettere altri collaboratori», e una
 *  regola con due eccezioni che si accendono da sole è una regola che l'utente
 *  vede disattesa senza capire perché — proprio nel caso più comune, cioè il
 *  giorno in cui le spunte non le ha ancora messe nessuno.
 *  Il prezzo di questa scelta è dichiarato: se una posa è assegnata a qualcuno
 *  che non ha la spunta, quella persona NON è filtrabile finché non gliela si
 *  mette. È un caso che si risolve con una spunta nella sua scheda, e la
 *  pagina lo dice quando l'elenco resta vuoto (vedi `nessuno`).
 *
 *  ⚠️ NON È IL GEMELLO DI `esecutoriPossibili` (InstallationScheduleDialog) NÉ
 *  DI `manutentoriPossibili` (manutenzione/squadra). Quelli rispondono a «chi
 *  posso SCEGLIERE» e tengono in coda la persona già scritta sulla pratica,
 *  perché lì un elenco che perde un nome cancellerebbe un dato vero da una
 *  finestra di scrittura. Questo risponde a «chi posso CERCARE»: non scrive
 *  niente, e un nome che manca costa un filtro in meno, non un dato perso.
 *
 *  I DUE MESTIERI STANNO INSIEME di proposito. Nelle pagine le pose e le
 *  manutenzioni si guardano dalla stessa barra (le lenti «Nel nostro centro»,
 *  «A domicilio», «Da spedire», «Con driver», «Manutenzioni»): due elenchi di
 *  nomi che cambiano sotto le mani a seconda della lente sarebbero un filtro
 *  che si svuota da solo, e chi fa entrambi i mestieri comparirebbe due volte. */
import type { Consultant } from "./types";
import { mestieriDi } from "./kpi-setter";

export function personePerInstallazioni(consulenti: Consultant[]): {
  elenco: Consultant[];
  /** Vero quando in anagrafica c'è gente attiva ma nessuno fa l'installatore o
   *  il manutentore: la barra non ha nomi da mostrare, e la ragione non è «non
   *  ci sono collaboratori» ma «manca una spunta». Sono due frasi diverse e
   *  portano in due posti diversi, quindi si distinguono qui e non a schermo. */
  nessuno: boolean;
} {
  const attivi = consulenti.filter((c) => c.data.attivo);
  //  L'ordine dell'anagrafica si conserva: i nomi delle pastiglie non devono
  //  spostarsi sotto le mani quando qualcuno prende o perde una posa.
  const elenco = attivi.filter((c) => {
    const m = mestieriDi(c.data);
    return m.faInstallatore || m.faManutentore;
  });
  return { elenco, nessuno: elenco.length === 0 && attivi.length > 0 };
}
