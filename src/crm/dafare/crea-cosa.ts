/** ── SCRIVERE UNA COSA DA FARE, CON TUTTO QUELLO CHE SI PORTA DIETRO ───────
 *
 *  Le cose da fare si scrivono da DUE pagine — «Da fare oggi» e la coda del
 *  setter — e sono la stessa lista. Finché il gesto era «aggiungi una riga»
 *  bastava che tutte e due chiamassero `nuovoTask`; da quando una riga può
 *  anche BLOCCARE UN'ORA di agenda, il gesto ha due passi che devono andare
 *  insieme, e due copie divergono al primo ritocco — con il risultato che da
 *  una pagina l'agenda si blocca e dall'altra no, senza che nessuno lo sappia.
 *
 *  ⚠️ L'ORDINE NON È INDIFFERENTE: prima il blocco, poi la riga. Se il blocco
 *   non riesce a scriversi, la riga non deve nascere dicendo «occupa l'agenda»
 *   mentre l'agenda è libera — una riga che mente è peggio di una riga che
 *   manca, perché nessuno va a controllarla.
 */
import { caricaBlocchi, salvaBlocchi } from "@/crm/blocchi";
import { bloccoDaTask } from "./agenda-task";
import { nuovoTask, type Gesto, type TaskManuale } from "./task-manuali";

export interface CampiCosa {
  testo: string;
  data: string;
  ora: string;
  aId: string;
  aNome: string;
  perId: string;
  perNome: string;
  occupaAgenda: boolean;
  durata: number;
}

export interface EsitoCreazione {
  ok: boolean;
  /** Il guasto, già in italiano, pronto per il toast. */
  errore?: string;
  /** La riga creata: serve a chi vuole dire dov'è finita. */
  task?: TaskManuale;
  /** L'agenda è stata bloccata davvero. */
  bloccata?: boolean;
}

/** Crea la riga e, se serve, il blocco dell'agenda.
 *  `applica` è il gesto della pagina (rileggi → applica → riscrivi): resta suo,
 *  perché è l'unico posto che sa se una scrittura è andata a buon fine. */
export async function creaCosaDaFare(
  campi: CampiCosa,
  autore: { id?: string; nome?: string },
  applica: (g: Gesto) => Promise<{ ok: boolean; errore?: string }>,
): Promise<EsitoCreazione> {
  const task = nuovoTask({
    testo: campi.testo,
    data: campi.data,
    ora: campi.ora,
    di: autore.id,
    diNome: autore.nome,
    aId: campi.aId,
    aNome: campi.aNome,
    perId: campi.perId,
    perNome: campi.perNome,
    occupaAgenda: campi.occupaAgenda,
    durata: campi.durata,
  });

  const blocco = bloccoDaTask({ ...task, aId: campi.aId });
  if (blocco) {
    const prima = await caricaBlocchi();
    const esito = await salvaBlocchi([...prima, blocco]);
    if (!esito.ok) return { ok: false, errore: esito.errore };
    task.bloccoId = blocco.id;
  }

  const salvata = await applica({ tipo: "aggiungi", task });
  if (!salvata.ok) {
    //  ⚠️ La riga non è entrata: il blocco che avevamo appena scritto non ha
    //   più un padrone, e resterebbe a chiudere un'ora per sempre senza che
    //   nessuno sappia perché. Si toglie subito.
    if (blocco) {
      try {
        const adesso = await caricaBlocchi();
        await salvaBlocchi(adesso.filter((b) => b.id !== blocco.id));
      } catch {
        /* se anche questo fallisce resta il guasto vero, che è già raccontato */
      }
    }
    return { ok: false, errore: salvata.errore };
  }
  return { ok: true, task, bloccata: !!blocco };
}

/** Toglie il blocco che una riga si porta dietro. Da chiamare PRIMA di
 *  cancellarla: lasciandolo, il calendario resta chiuso per una cosa che non
 *  esiste più — e fra un mese nessuno saprà perché quel martedì alle 15 non si
 *  prenota. Torna il guasto, o niente se è andata (o se non c'era nulla da
 *  togliere). */
export async function liberaAgendaDi(task?: TaskManuale | null): Promise<string | null> {
  if (!task?.bloccoId) return null;
  const prima = await caricaBlocchi();
  const esito = await salvaBlocchi(prima.filter((b) => b.id !== task.bloccoId));
  return esito.ok ? null : (esito.errore ?? "Non sono riuscito a liberare l'agenda");
}
