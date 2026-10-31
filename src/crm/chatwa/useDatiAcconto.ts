/** ── I DATI DEL BONIFICO, LETTI UNA VOLTA PER CHAT ──────────────────────────
 *  Richiesta del titolare (31/10/2026): il messaggio «IBAN per l'acconto» si
 *  riempie da solo. Le regole stanno in ./dati-acconto e ./risposte-rapide; qui
 *  solo le letture, fatte quando si apre la chat e non a ogni tasto premuto:
 *   - IBAN e intestatario: `leggiAzienda()` (impostazioni Fatture, `app_config`),
 *     UNA volta per sessione del browser, condivisa fra le chat. Se la lettura
 *     fallisce non si ricorda l'errore: la chat dopo riprova;
 *   - acconto e causale: dal preventivo del lead, una volta per lead.
 *     Il legame è `data.quoteRef`, col confronto ESATTO fatto dalla rotta.
 *     Se la scheda non l'ha dichiarato e il cliente è in Attesa acconto, si
 *     cerca per telefono come fa la finestra della fattura
 *     (`preventivoDaCitare`: scarta i preventivi sostituiti, prende il più recente).
 *  ⚠️ Niente di inventato: dato non trovato = vuoto, e il segnaposto resta nel
 *   messaggio (la casella avvisa). Le letture rispettano l'accesso del CRM:
 *   `app_config` e `quote_requests` con la sessione di chi è dentro; il
 *   preventivo si chiede alla rotta pubblica che già serve il link del cliente.
 *  ⚠️ Cambiando chat i dati dell'altro cliente NON restano: la risposta di una
 *   chat vecchia che arriva tardi si butta (`vivo`). */
import { useEffect, useState } from "react";
import { leggiAzienda } from "@/crm/fatture/archivio";
import { leggiPreventiviDelLead, preventivoDaCitare } from "@/crm/preventivi/dati";
import type { Lead } from "@/crm/types";
import { accontoDaPreventivo, type DatiAcconto } from "./dati-acconto";

export interface DatiBonifico {
  acconto: number | null;
  causalePreventivo: string;
  iban: string;
  intestatario: string;
}

const VUOTI: DatiBonifico = { acconto: null, causalePreventivo: "", iban: "", intestatario: "" };

let aziendaLetta: Promise<{ iban: string; intestatario: string }> | null = null;

/** IBAN e intestatario dalle impostazioni Fatture, letti una volta per sessione. */
function leggiBonifico() {
  aziendaLetta ??= leggiAzienda()
    .then((a) => ({
      iban: String(a.iban ?? "").trim(),
      intestatario: String(a.denominazione ?? "").trim(),
    }))
    .catch(() => {
      aziendaLetta = null;
      return { iban: "", intestatario: "" };
    });
  return aziendaLetta;
}

async function leggiPreventivo(lead: Lead): Promise<DatiAcconto | null> {
  let rif = String(lead.data.quoteRef ?? "").trim();
  if (!rif && lead.data.stato === "in_attesa_acconto") {
    const righe = await leggiPreventiviDelLead(lead);
    rif = String(preventivoDaCitare(lead, righe)?.q.quote_ref ?? "").trim();
  }
  if (!rif) return null;
  //  `segui=1`: se il preventivo è stato rifatto vale l'ultimo della catena, non quello annullato.
  const r = await fetch(`/api/public/quote?ref=${encodeURIComponent(rif)}&segui=1`);
  return accontoDaPreventivo(await r.json());
}

export function useDatiAcconto(lead: Lead | null | undefined): DatiBonifico {
  const [dati, setDati] = useState<DatiBonifico>(VUOTI);
  const id = lead?.id ?? null;
  const rif = String(lead?.data.quoteRef ?? "").trim();
  const inAttesa = lead?.data.stato === "in_attesa_acconto";

  useEffect(() => {
    setDati(VUOTI);
    if (!lead) return;
    let vivo = true;
    void Promise.all([leggiBonifico(), leggiPreventivo(lead).catch(() => null)]).then(
      ([azienda, preventivo]) => {
        if (!vivo) return;
        setDati({
          acconto: preventivo?.acconto ?? null,
          causalePreventivo: preventivo?.causale ?? "",
          ...azienda,
        });
      },
    );
    return () => {
      vivo = false;
    };
    //  Una lettura per chat: `lead` intero cambia a ogni salvataggio della scheda e rifarebbe
    //  le chiamate. Contano il lead, il suo preventivo dichiarato e l'entrata in Attesa acconto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rif, inAttesa]);

  return dati;
}
