/** ── PREPARARE LA BOZZA DI FATTURA DAL PREVENTIVO ──────────────────────────
 *  POST { code?, ref?, importo, tipo?, descrizione?, causale?, email, cliente }
 *       -> { ok: true, bozza } | { ok: false, reason }
 *
 *  ── PERCHÉ UNA ROTTA E NON UNA SCRITTURA DAL BROWSER ──────────────────────
 *  Il configuratore del preventivo è una pagina PUBBLICA, e la chiave pubblica
 *  di Supabase non può scrivere su `app_config`: la RLS la rifiuta (provato:
 *  «new row violates row-level security policy»). Ed è giusto così — quella
 *  tabella contiene il listino, i rimandi dei preventivi e adesso le fatture.
 *  Quindi si passa di qui, con la chiave di servizio e dietro la stessa guardia
 *  delle altre azioni del presentatore.
 *
 *  ── ⚠️ QUI NON SI EMETTE NIENTE ───────────────────────────────────────────
 *  Si scrive una BOZZA: nessun numero, nessuna data, niente che tocchi la
 *  numerazione. Il perché per esteso sta in cima a crm/fatture/tipi.ts — numero
 *  e data sono un fatto fiscale e nascono con l'incasso, non con il preventivo.
 *  Questa rotta non sa nemmeno come si numera.
 *
 *  ── ⚠️ LA CHIAVE È L'EMAIL, PERCHÉ LA SCHEDA NON ESISTE ANCORA ────────────
 *  Dal configuratore si sta ancora costruendo il preventivo: di scheda cliente
 *  non ce n'è una, e l'unica cosa stabile è la persona. La bozza si salva su
 *  `fattura_bozza:q:<email>` e porta `emailOrigine`, che è come il CRM la
 *  ritrova più tardi (`leggiBozzaDi` in crm/fatture/archivio) invece di far
 *  ribattere codice fiscale e residenza — o, peggio, di creare una seconda
 *  bozza per lo stesso cliente.
 *
 *  ── L'IMPORTO È QUELLO CHE SI STA PER INCASSARE ───────────────────────────
 *  Cioè l'acconto, non il totale del preventivo: lo manda il browser, che è
 *  quello che ha in mano la cifra mostrata al cliente. Il server non lo
 *  ricalcola per la stessa ragione per cui non ricalcola i totali in
 *  api.presenter.quote-revise: due copie dello stesso conto divergono, e il
 *  giorno in cui divergono il documento non è più quello che il cliente ha visto.
 *  Quello che il server fa da sé è lo SCORPORO dell'IVA, che dipende
 *  dall'aliquota scritta nelle impostazioni e non da quello che dice il browser.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { contoDaLordo } from "@/crm/fatture/conti";
//  ⚠️ LA NUMERAZIONE NON SI RISCRIVE QUI. Si prende in prestito quella del CRM
//   passandole l'archivio del server: due funzioni che decidono qual è il
//   prossimo numero di fattura, il giorno in cui divergono, fanno uscire due
//   documenti con lo stesso numero — uno dal CRM e uno dal preventivo — e il
//   problema lo scopre il commercialista mesi dopo.
import { archivioSu, emettiSu, leggiAziendaSu } from "@/crm/fatture/archivio";
import { AZIENDA_VUOTA, CLIENTE_VUOTO, type DatiAzienda, type Fattura } from "@/crm/fatture/tipi";
import {
  INTESTAZIONI_CONSENTITE,
  autorizzaPresentatore,
  nonAutorizzato,
} from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const db = supabaseAdmin as unknown as SupabaseClient;

/** Una cifra che arriva dal browser e finisce su un documento: o è un numero
 *  vero e ragionevole, o non si scrive niente. */
const cifra = (v: unknown): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
};

/** Il giorno di oggi in AAAA-MM-GG. */
const oggiIso = (): string => new Date().toISOString().slice(0, 10);

const testo = (v: unknown, max = 120): string =>
  String(v ?? "")
    .trim()
    .slice(0, max);

export const Route = createFileRoute("/api/presenter/fattura-bozza")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: Record<string, unknown> = {};
        try {
          b = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ ok: false, reason: "richiesta illeggibile" }, 400);
        }

        //  Stessa guardia delle altre azioni del presentatore: senza sessione o
        //  codice non si scrive niente in archivio.
        const chi = await autorizzaPresentatore(request, testo(b.code, 80));
        if (!chi) return nonAutorizzato(cors);

        const email = testo(b.email, 160).toLowerCase();
        if (!email) return json({ ok: false, reason: "manca l'email del cliente" }, 400);
        const importo = cifra(b.importo);
        if (importo === null) return json({ ok: false, reason: "importo non valido" }, 400);

        //  L'aliquota è quella delle impostazioni: lo scorporo non si fa dire
        //  dal browser. Si legge con lo stesso codice del CRM, sopra l'archivio
        //  del server.
        const archivio = archivioSu(db);
        const azienda: DatiAzienda = await leggiAziendaSu(archivio);

        const conto = contoDaLordo(importo, azienda.aliquotaPredefinita);
        const c = (b.cliente ?? {}) as Record<string, unknown>;
        const chiave = `q:${email}`;
        const descrizione = testo(b.descrizione, 200) || "Fornitura impianto capillare";
        const ref = testo(b.ref, 20).toUpperCase();

        const bozza: Fattura = {
          id: `bozza:${chiave}`,
          stato: "bozza",
          numero: 0,
          anno: new Date().getFullYear(),
          serie: azienda.serie || "",
          data: "",
          //  Nessun incasso ancora: la data si dichiara emettendo, dal CRM.
          dataPagamento: "",
          //  ⚠️ «acconto» e non «unica»: questa bozza nasce da un preventivo,
          //   cioè prima che il cliente abbia pagato tutto. Il tipo serve al
          //   saldo, che deve sapere quanto è già stato fatturato per non
          //   fatturarlo una seconda volta.
          tipo: b.tipo === "unica" || b.tipo === "saldo" ? (b.tipo as Fattura["tipo"]) : "acconto",
          leadId: chiave,
          leadNome: `${testo(c.nome, 60)} ${testo(c.cognome, 60)}`.trim() || email,
          preventivoRef: ref,
          cliente: {
            ...CLIENTE_VUOTO,
            azienda: c.azienda === true,
            denominazione: testo(c.denominazione, 80),
            nome: testo(c.nome, 60),
            cognome: testo(c.cognome, 60),
            codiceFiscale: testo(c.codiceFiscale, 16).toUpperCase(),
            partitaIva: testo(c.partitaIva, 13),
            indirizzo: testo(c.indirizzo, 60),
            civico: testo(c.civico, 8),
            cap: testo(c.cap, 5),
            comune: testo(c.comune, 60),
            provincia: testo(c.provincia, 2).toUpperCase(),
            nazione: testo(c.nazione, 2).toUpperCase() || "IT",
            codiceDestinatario: testo(c.codiceDestinatario, 7).toUpperCase() || "0000000",
            pec: testo(c.pec, 160),
          },
          righe: [
            {
              descrizione,
              quantita: 1,
              prezzoUnitario: conto.imponibile,
              aliquota: conto.aliquota,
            },
          ],
          //  Identica a quella del bonifico: vedi `causalePredefinita` in
          //  crm/fatture/FinestraFattura — è il filo con cui si lega il
          //  versamento al documento, e due frasi diverse lo spezzano.
          causale: testo(b.causale, 200) || (ref ? `Conferma ordine - ${ref}` : "Conferma ordine"),
          imponibile: conto.imponibile,
          imposta: conto.imposta,
          totale: conto.totale,
          creataIl: new Date().toISOString(),
          emessaIl: "",
          emailOrigine: email,
        };

        //  ── ⚠️ BOZZA O FATTURA VERA, E LO DECIDE CHI CHIAMA ──────────────
        //   Il committente ha chiesto che dal preventivo esca una fattura
        //   EMESSA, non una bozza: numero e data subito, insieme all'ordine.
        //   È una sua scelta, presa sapendo cosa comporta — lo scrivo qui perché
        //   chi legge questo file fra un anno non se lo deve ricostruire:
        //   emettendo prima dell'incasso, l'IVA di quella fattura è dovuta anche
        //   se il cliente poi non paga, e in quel caso si storna con una nota di
        //   credito.
        //   ⚠️ LA DATA DEL DOCUMENTO È OGGI, ed è l'unica possibile: non si può
        //    datare un incasso che non c'è ancora.
        //   ⚠️ E `dataPagamento` RESTA VUOTA. `emettiSu` la fa coincidere con la
        //    data del documento — giusto quando si fattura DOPO aver incassato;
        //    qui si fattura prima, e stampare «pagamento ricevuto oggi» su una
        //    fattura emessa prima del bonifico sarebbe una quietanza falsa. Si
        //    riempie quando i soldi arrivano davvero, dalla pagina Fatture.
        if (b.emetti === true) {
          const esito = await emettiSu(archivio, bozza, azienda, oggiIso());
          if (!esito.ok || !esito.fattura)
            return json({ ok: false, reason: esito.errore ?? "numerazione non riuscita" }, 500);
          const emessa = { ...esito.fattura, dataPagamento: "" };
          const guasto = await archivio.scrivi(
            `fattura:${emessa.id}${azienda.serie ? `-${azienda.serie}` : ""}`,
            JSON.stringify(emessa),
          );
          if (guasto) return json({ ok: false, reason: guasto }, 500);
          return json({ ok: true, fattura: emessa });
        }

        const errore = await archivio.scrivi(`fattura_bozza:${chiave}`, JSON.stringify(bozza));
        if (errore) return json({ ok: false, reason: errore }, 500);
        return json({ ok: true, bozza });
      },
    },
  },
});
