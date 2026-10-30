/** ── L'ELENCO DELLE CHAT, COSTRUITO DAI DATI (p1-chat-veloce, 30/10/2026) ───────
 *  Era il corpo di un `useMemo` dentro `useChatWa`: spostato qui, uguale, perché si possa
 *  misurare e provare senza React. Pura: niente rete, niente stato. Una chat per telefono
 *  (contatti, messaggi letti, schede senza chat «da chiamare»), con scheda, «Da rispondere»,
 *  finestra di 24 ore e STOP (le regole stanno in stato.ts), dal movimento più recente. */
import { quandoUltimo } from "./ordineWhatsapp";
import { calcolaDaChiamare, telefonoE164 } from "./daChiamare";
import { daRispondere as calcolaDaRispondere, finestra24, indiceSchede } from "./stato";
import type { Lead } from "@/crm/types";
import type { ChatItem, WaContactRow, WaMessageRow } from "./tipi";

const ms = (x: string | null | undefined) => (x ? Date.parse(x) : NaN);

export function costruisciChat(p: {
  tutti: WaMessageRow[];
  contacts: WaContactRow[];
  leads: Lead[];
  adesso: number;
  ottimistici: Record<string, number>;
}): ChatItem[] {
  const { tutti, contacts, leads, adesso, ottimistici } = p;
  const map = new Map<string, ChatItem>();
  const perChat = new Map<string, WaMessageRow[]>();

  // partenza: contatti
  for (const c of contacts) {
    map.set(c.phone_e164, {
      phone: c.phone_e164,
      leadId: c.lead_id ?? null,
      lead: null,
      contact: c,
      lastMessage: null,
    });
  }

  // aggiungo dai messaggi (per phone "interlocutore")
  for (const m of tutti) {
    const peer = m.direction === "inbound" ? m.from_number : m.to_number;
    // se peer è un phone_number_id (nessun +), lo skip
    if (!peer || !peer.startsWith("+")) {
      // outbound persistito con peer = numero destinatario (ok). inbound: m.from_number è già normalizzato +...
      // se non parte con + skippiamo (è solo phone_number_id meta)
      if (m.direction === "outbound") {
        // peer = m.to_number normalizzato
      } else {
        continue;
      }
    }
    const key = peer.startsWith("+") ? peer : `+${peer}`;
    let item = map.get(key);
    if (!item) {
      item = {
        phone: key,
        leadId: m.lead_id ?? null,
        lead: null,
        contact: null,
        lastMessage: null,
      };
      map.set(key, item);
    }
    const suoi = perChat.get(key);
    if (suoi) suoi.push(m);
    else perChat.set(key, [m]);
    if (!item.lastMessage || ms(m.created_at) > ms(item.lastMessage.created_at)) {
      item.lastMessage = m;
    }
  }

  //  ── CHI ASPETTA SU WHATSAPP MA NEL CRM NON HA UNA CHAT (28/10/2026) ──
  //   La setter scrive spesso dal WhatsApp del telefono: quei lead non hanno
  //   messaggi qui. Se sono in attesa da più di 10 ore entrano lo stesso,
  //   così compaiono in «Da chiamare» e si chiamano dal tasto in alto.
  const ultime9 = new Set([...map.keys()].map((k) => k.replace(/\D/g, "").slice(-9)));
  //   Qui `messaggi` è vuoto di proposito (30/10/2026): chi ha anche un solo messaggio o
  //   contatto ha già la sua chat in `map` e viene saltato più sotto; chi non ce l'ha non ha
  //   messaggi da passare. Per le chat con scheda decide lo STATO, che il cron scrive con
  //   la stessa funzione pura (`calcolaDaChiamare` con i messaggi degli ultimi 7 giorni).
  const orologio = new Date(adesso);
  for (const l of leads) {
    if (!calcolaDaChiamare({ dati: l.data, messaggi: [], adesso: orologio }).si) continue;
    const tel = telefonoE164(l.data?.telefono);
    if (!tel || ultime9.has(tel.replace(/\D/g, "").slice(-9))) continue;
    ultime9.add(tel.replace(/\D/g, "").slice(-9));
    map.set(tel, {
      phone: tel,
      leadId: l.id,
      lead: null,
      contact: null,
      lastMessage: null,
    });
  }

  // scheda, «Da rispondere», finestra di 24 ore, STOP (le regole sono in stato.ts)
  //  Le schede si indicizzano UNA volta (per id e per ultime 9 cifre): prima ogni chat rileggeva
  //  tutte le schede (2.000 schede x 1.400 chat = milioni di confronti a ogni evento).
  const perId = new Map<string, Lead>();
  for (const l of leads) if (!perId.has(l.id)) perId.set(l.id, l);
  const schedaUnica = indiceSchede(leads);
  for (const item of map.values()) {
    //  La scheda scelta vince; altrimenti per telefono SOLO se ce n'è una sola (D18).
    let lead = item.leadId ? (perId.get(item.leadId) ?? null) : null;
    let senzaScheda = false;
    let schedaAmbigua = false;
    if (!lead) {
      const e = schedaUnica(item.phone);
      if (e.tipo === "una") lead = e.lead;
      else if (e.tipo === "piu") schedaAmbigua = true;
      else senzaScheda = true;
    }
    item.lead = lead;
    item.leadId = lead?.id ?? item.leadId;
    item.senzaScheda = senzaScheda;
    item.schedaAmbigua = schedaAmbigua;
    item.stop = Boolean(item.contact?.non_scrivere_dal);

    //  Risposta appena data (o «Fatto»): vale come il database la scriverà,
    //  `greatest(ora, ultimo messaggio del cliente)`, così un orologio indietro non la smentisce.
    const fatto = ottimistici[item.phone];
    const entrata = item.contact?.ultimo_in_entrata_il ?? null;
    const rispostoServer = item.contact?.risposto_il ?? null;
    const risposto =
      fatto === undefined
        ? rispostoServer
        : new Date(Math.max(fatto, ms(entrata) || 0, ms(rispostoServer) || 0)).toISOString();
    const contatto = item.contact
      ? { ...item.contact, risposto_il: risposto }
      : risposto
        ? { risposto_il: risposto }
        : null;
    const messaggi = perChat.get(item.phone) ?? [];
    const dr = calcolaDaRispondere({ contatto, messaggi, adesso, ultimo: item.lastMessage });
    item.daRispondere = {
      attesa: dr.attesa,
      dal: dr.dal,
      anteprima: dr.anteprima,
    };
    const f = finestra24({ contatto, messaggi, adesso });
    item.finestra = { aperta: f.aperta, frase: f.frase, scadeIl: f.scadeIl };
  }

  // ordina per ultimo movimento, come WhatsApp: la stessa ora di «Tutte» (ordineWhatsapp.ts), cioè il
  // messaggio più recente fra quelli caricati e l'ultimo messaggio del contatto. NON `last_message_at`
  // né l'ultima entrata: li scrive anche l'eco di ManyChat (poi nascosta come doppione).
  //  Le ore si calcolano una volta per chat, non a ogni confronto del sort (stabile: a pari ora resta l'ordine).
  return Array.from(map.values())
    .map((c) => ({ c, q: quandoUltimo(c) }))
    .sort((a, b) => b.q - a.q)
    .map((x) => x.c);
}
