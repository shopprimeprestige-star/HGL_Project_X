/** ── PRENOTA IN CHAT: LA STANZA E IL LINK ──────────────────────────────────
 *
 *  Commessa 2026-10-27 (PIANO.md, compito T5, decisione D4). Prove in
 *  `prove/manychat/prenota-stanza.mjs`.
 *
 *  Salvando una consulenza dal CRM, è il BROWSER a chiamare la rotta
 *  `api.crm.meeting-session`, che crea la stanza e il link. Una prenotazione
 *  fatta dal cliente in chat non passa dal browser: se nessuno crea la stanza,
 *  la conferma parte col ripiego «il link te lo mando poco prima». Qui si rifà
 *  quello che fa la rotta per un appuntamento, dal server, con una porta su
 *  `app_config` (`PorteStanza`) e senza toccare la rotta.
 *
 *  ⚠️ È UNA COPIA DELLA LOGICA, NON UNA RIFATTORIZZAZIONE: la rotta si usa ogni
 *   giorno e non ha prove di integrazione, quindi non si tocca. Le chiavi e le
 *   regole vengono dalle stesse funzioni pure che la rotta importa
 *   (`chiaveStanza`, `chiaveStanzaStorica`, `chiaveAttesi`, `unisciAttesi`...) e
 *   una prova di parità controlla che le righe scritte abbiano la stessa forma.
 *   Debito dichiarato: quando qualcuno rifattorizzerà la rotta, le due logiche
 *   si uniscono.
 *  ⚠️ IL LINK GIÀ MANDATO VINCE SU TUTTO (stessa regola della rotta): se il
 *   lead ha già una stanza si riusa il suo codice. Altrimenti codice NUOVO, non
 *   quello della riga fascia: con «uno per ora» la fascia è vuota, e riusare il
 *   codice di chi non c'è più metterebbe il lead nella stanza di un altro.
 *  ⚠️ LA CHIAVE FASCIA SI COSTRUISCE DALLA STRINGA, non da una `Date`: la
 *   `chiaveFascia` della rotta passa da `Date.parse("AAAA-MM-GGTHH:MM")`, che è
 *   in ora locale. Sul Worker (UTC) dà l'ora scritta com'è; altrove slitta. Qui
 *   si chiede alla stessa funzione con un `Z` in fondo, così il risultato è
 *   quello del Worker in qualunque fuso, e il consulente si pulisce nello
 *   stesso modo.
 *  ⚠️ LA RIGA FASCIA SI RISCRIVE CONSERVANDO `modo`: la `segnaFascia` della
 *   rotta riscrive `{ code, il }` e perde «solo» (un'ora tenuta per uno solo
 *   tornerebbe «aperta»). Qui il modo, se c'era, resta.
 *  ⚠️ `annulla()` è il registro di annullo: per ogni riga scritta rimette il
 *   valore che c'era (o la toglie), così una prenotazione disfatta non lascia
 *   il lead fra gli attesi né righe `fascia:`/`attesi:` orfane. Si chiama
 *   quando la prenotazione viene disfatta o la scrittura della scheda fallisce.
 *   `assicuraStanza` si chiama SOLO dopo che l'orchestratore ha verificato
 *   scheda e slot: non scrive niente prima.
 *  ───────────────────────────────────────────────────────────────────────── */
import { urlStanza } from "@/lib/sito";
import {
  chiaveFascia,
  chiaveAttesi,
  leggiAttesi,
  leggiModoFascia,
  scriviAttesi,
  unisciAttesi,
} from "../fascia-consulenza";
import { giornoParlato, oraNormale } from "../promemoria/formati";
import { chiaveStanza, chiaveStanzaStorica } from "../stanza-consulenza";
import type { EsitoStanza, InputStanza, PorteStanza } from "./prenota-tipi";

/** Il contenuto di `meet:<lead>`: gli stessi campi, nello stesso ordine, della
 *  `Sessione` della rotta. */
interface Sessione {
  code: string;
  leadId: string;
  consultantId: string;
  quando: string;
  durata: number;
  createdAt: string;
}

/** Stesso alfabeto dei codici del consulente: niente vocali, niente lettere che
 *  si confondono a voce. Un codice si detta al telefono. */
const ALFABETO = "bcdfghjkmnpqrstvwxyz";
function gruppo(n: number): string {
  const r = new Uint32Array(n);
  crypto.getRandomValues(r);
  let s = "";
  for (let i = 0; i < n; i++) s += ALFABETO[r[i] % ALFABETO.length];
  return s;
}
const nuovoCodice = () => `${gruppo(3)}-${gruppo(4)}-${gruppo(3)}`;

/** La sessione scritta in una riga, o `null` se la riga manca o non si legge
 *  (come `leggiChiave` della rotta: illeggibile = non c'è). */
function leggiSessione(grezzo: string | null): Sessione | null {
  try {
    const s = JSON.parse(grezzo || "null") as Sessione | null;
    return s && typeof s === "object" && typeof s.code === "string" && s.code ? s : null;
  } catch {
    return null;
  }
}

export async function assicuraStanza(porte: PorteStanza, i: InputStanza): Promise<EsitoStanza> {
  const leadId = String(i.leadId ?? "").trim();
  const consulenteId = String(i.consulenteId ?? "").trim();
  const ora = oraNormale(i.ora);
  if (!leadId || !consulenteId || !ora || giornoParlato(i.giorno) === null) {
    throw new Error("stanza: lead, consulente, giorno o ora non validi");
  }
  const quando = `${i.giorno}T${ora}`;
  const adessoIso = i.adesso.toISOString();

  //  Il registro di annullo: la riga e com'era PRIMA (null = non c'era).
  const registro: { chiave: string; prima: string | null }[] = [];
  const annulla = async (): Promise<void> => {
    let primoErrore: unknown;
    let fallito = false;
    //  Dall'ultima alla prima. Una riga che non si rimette resta nel registro:
    //  si può riprovare, e intanto le altre tornano com'erano.
    for (const voce of [...registro].reverse()) {
      try {
        if (voce.prima === null) await porte.elimina(voce.chiave);
        else await porte.scrivi(voce.chiave, voce.prima);
        registro.splice(registro.indexOf(voce), 1);
      } catch (e) {
        if (!fallito) primoErrore = e;
        fallito = true;
      }
    }
    if (fallito) throw primoErrore;
  };
  /** Scrive solo se il valore cambia, e ricorda com'era. */
  const scrivi = async (chiave: string, prima: string | null, valore: string): Promise<void> => {
    if (prima === valore) return;
    await porte.scrivi(chiave, valore);
    registro.push({ chiave, prima });
  };

  try {
    // (1) La stanza che questo lead ha già: prima la storica, poi la copia per
    //     consulente. Il link già partito vince.
    const kStorica = chiaveStanzaStorica(leadId);
    const kCoppia = chiaveStanza(leadId, consulenteId);
    const grezzaStorica = await porte.leggi(kStorica);
    const grezzaCoppia = kCoppia === kStorica ? grezzaStorica : await porte.leggi(kCoppia);
    const esistente = leggiSessione(grezzaStorica) ?? leggiSessione(grezzaCoppia);

    // (2) Altrimenti un codice nuovo.
    const code = esistente ? esistente.code : nuovoCodice();
    const sessione: Sessione = {
      code,
      leadId,
      consultantId: consulenteId,
      quando,
      durata: Number(i.durata) || esistente?.durata || 45,
      createdAt: esistente?.createdAt || adessoIso,
    };

    // (3) La stanza dell'appuntamento, e la copia sotto il consulente.
    const valoreSessione = JSON.stringify(sessione);
    await scrivi(kStorica, grezzaStorica, valoreSessione);
    if (kCoppia !== kStorica) await scrivi(kCoppia, grezzaCoppia, valoreSessione);

    // (4) La fascia (stesso consulente, stessa ora = stessa consulenza), DOPO la
    //     stanza: una fascia che punta a una stanza che non esiste manderebbe la
    //     persona dopo in una stanza vuota. Il `modo` di prima resta.
    const kFascia = chiaveFascia(consulenteId, `${i.giorno}T${ora}:00Z`);
    if (kFascia) {
      const grezzaFascia = await porte.leggi(kFascia);
      let conModo = false;
      try {
        conModo =
          typeof (JSON.parse(grezzaFascia || "null") as { modo?: unknown } | null)?.modo ===
          "string";
      } catch {
        /* riga illeggibile: si riscrive pulita */
      }
      const valoreFascia = JSON.stringify({
        code,
        il: adessoIso,
        ...(conModo ? { modo: leggiModoFascia(grezzaFascia) } : {}),
      });
      await scrivi(kFascia, grezzaFascia, valoreFascia);
    }

    // (5) Chi è atteso in questa stanza. ⚠️ È «una comodità» (la rotta la
    //     tratta così): un errore qui non fa fallire la prenotazione, il
    //     cliente scriverà il suo nome come ha sempre fatto.
    try {
      const kAttesi = chiaveAttesi(code);
      const grezzaAttesi = await porte.leggi(kAttesi);
      const dopo = unisciAttesi(leggiAttesi(grezzaAttesi), {
        leadId,
        nome: String(i.nome ?? "").trim() || "Cliente",
        cognome: String(i.cognome ?? "").trim(),
      });
      await scrivi(kAttesi, grezzaAttesi, scriviAttesi(dopo));
    } catch {
      /* l'elenco è una comodità: senza, si entra scrivendo il nome */
    }

    return { code, link: urlStanza(code), nuova: !esistente, annulla };
  } catch (e) {
    //  Un errore sulla stanza o sulla fascia lancia, e non lascia righe a metà.
    try {
      await annulla();
    } catch {
      /* si segnala l'errore originale: quello di prima è il motivo */
    }
    throw e;
  }
}
