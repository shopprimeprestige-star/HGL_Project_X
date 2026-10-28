/** ── LA CHAT WHATSAPP · DATI, EFFETTI E AZIONI DELLA PAGINA ────────────────
 *
 *  Commessa 2026-10-28, T6: il corpo "senza vista" di `CRM.whatsapp.tsx`, spostato
 *  qui senza cambiare comportamento. T7 ci ha aggiunto «Da rispondere», finestra
 *  di 24 ore, canale, invio dei modelli, «Fatto», abbinamento. Le regole stanno
 *  in `stato.ts` (pure, provate): qui si leggono i dati e si chiamano.
 *
 *  Gli effetti, perché nello spostamento non ne sparisca uno:
 *   1. carica i modelli di testo salvati (servono a otto pagine, non solo all'editor);
 *   2. legge le chiavi Meta (`whatsapp_settings`) → `hasConfig`;
 *   3. legge il canale (`/api/crm/whatsapp-canale`) → `canale`;
 *   4. carica messaggi + contatti al montaggio e cambio utente (`reload`);
 *   5. realtime su `whatsapp_messages` e `whatsapp_contacts` → `reload`;
 *   6. legge TUTTA la chat aperta (e la rilegge a ogni `reload`);
 *   7. segna letto il contatto quando si apre una chat con `unread_count > 0`;
 *   8. un solo timer (30 s) tiene vere «da 25 min» e le ore rimaste.
 *  (Lo scorrimento in basso dei messaggi sta in `Conversazione`, dov'è il suo elemento.)
 *
 *  ⚠️ «Da rispondere» si ricava dalla RIGA DEL CONTATTO, non dai messaggi
 *   caricati: i messaggi sono solo i 2000 più recenti, le chat vecchie in attesa
 *   devono esserci lo stesso. Dove le colonne mancano (prima della migrazione) si
 *   ripiega sui messaggi (`stato.ts`, D5).
 *  ⚠️ APRIRE UNA CHAT NON LA TOGLIE da «Da rispondere»: il segna-letto scrive solo
 *   `unread_count`. Escono solo la risposta dal CRM e «Fatto».
 *  ⚠️ `daRispondere` di una chat è il risultato intero di `stato.ts`: `attesa`, `dal`,
 *   `anteprima`, `vecchia` (ripiego sui messaggi, senza risposta da più di 7 giorni:
 *   non è in elenco, serve alla riga «N chat senza risposta da più di 7 giorni»).
 *   `api.daRispondere` contiene solo le chat con `attesa` vera.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchCRM, useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { supabase } from "@/integrations/supabase/client";
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/crm/types";
import { requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { caricaModelliSalvati } from "@/crm/EditorMessaggi";
import { getWhatsAppMessageForStatus, segnapostiResidui } from "@/crm/whatsapp";
import type { StatoCanale } from "@/crm/prova-modelli";
import {
  daRispondere as calcolaDaRispondere,
  finestra24,
  ordinaDaRispondere,
  schedaUnica,
  statoCasella,
} from "./stato";
import type { ChatItem, ChatWaApi, FiltroChat, WaContactRow, WaMessageRow } from "./tipi";

function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/** Il risultato di una chiamata al database (i tipi generati non conoscono le colonne nuove). */
interface Esito {
  data: unknown;
  error: { code?: string; message: string } | null;
}
interface Query extends PromiseLike<Esito> {
  select(colonne: string): Query;
  eq(colonna: string, valore: string): Query;
  or(condizioni: string): Query;
  order(colonna: string, o: { ascending: boolean }): Query;
  limit(n: number): Query;
  update(valori: Record<string, unknown>): Query;
  delete(): Query;
}
const tabella = (t: string) => (supabase as unknown as { from: (t: string) => Query }).from(t);
const chiamaFunzione = (fn: string, args: Record<string, unknown>) =>
  (
    supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => PromiseLike<Esito> }
  ).rpc(fn, args);

/** Colonna non ancora creata (migrazione non applicata). */
const mancaColonna = (e: Esito["error"]) => ["42703", "PGRST204"].includes(String(e?.code ?? ""));
/** Funzione del database non ancora creata. */
const mancaFunzione = (e: Esito["error"]) => ["42883", "PGRST202"].includes(String(e?.code ?? ""));

/** I messaggi di una chat: il numero col «+» e senza, come `formati()` lato server. */
const filtroNumero = (phone: string) => {
  const d = digitsOnly(phone);
  return `from_number.eq.+${d},to_number.eq.+${d},from_number.eq.${d},to_number.eq.${d}`;
};

const ms = (x: string | null | undefined) => (x ? Date.parse(x) : NaN);

const FRASE_INVIO = "Invio non riuscito, riprova";

/** Come la pagina decide di cambiare stato a un lead: la finestra di chiusura e
 *  le finestre rapide stanno nella pagina (`PaginaChat`), il lead da cambiare no. */
export interface OpzioniChatWa {
  /** `true` se una finestra di chiusura vinta si è presa la scelta (non si scrive niente). */
  intercettaChiusura: (lead: Lead, stato: LeadStatus) => boolean;
  /** Lo stato richiede una finestra di campi extra: la pagina la apre. */
  apriStatoRapido: (lead: Lead, stato: LeadStatus) => void;
}

export function useChatWa(opz: OpzioniChatWa): ChatWaApi {
  const { user } = useAuth();
  const { leads, updateLead, consultants } = useCRM();
  const [filtro, setFiltro] = useState<FiltroChat>("all");
  const [ricerca, setRicerca] = useState("");
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [bozza, setBozza] = useState("");
  const [messages, setMessages] = useState<WaMessageRow[]>([]);
  const [contacts, setContacts] = useState<WaContactRow[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [inviando, setInviando] = useState(false);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [canale, setCanale] = useState<StatoCanale | null>(null);
  /** La chat aperta, letta per intero: i `messages` sono solo i 2000 più recenti. */
  const [extra, setExtra] = useState<{ phone: string; righe: WaMessageRow[] } | null>(null);
  const [letture, setLetture] = useState(0);
  /** Chat (per telefono) uscite da «Da rispondere» PRIMA che la ricarica lo confermi: ora locale. */
  const [ottimistici, setOttimistici] = useState<Record<string, number>>({});
  /** Chat a cui il server ha detto «solo modelli»: telefono → ultimo messaggio del cliente allora. */
  const [forzati, setForzati] = useState<Record<string, string | null>>({});
  const [adesso, setAdesso] = useState(() => Date.now());
  const inviandoRef = useRef(false);

  /** ── I TESTI MODIFICATI VANNO CARICATI QUI, NON NELL'EDITOR ───────────────
   *  Gli stessi modelli li compongono otto pagine (agenda, trattative, scheda
   *  cliente, area consulenti…) leggendo la copia in memoria di whatsapp.ts.
   *  Se li caricasse solo l'editor, chi non apre mai la scheda "Messaggi"
   *  scriverebbe ai clienti con i testi originali senza accorgersene. */
  useEffect(() => {
    void caricaModelliSalvati();
  }, []);

  // Carico config WhatsApp per mostrare banner se mancano credenziali
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (
                k: string,
                v: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: { phone_number_id?: string | null; access_token?: string | null } | null;
                }>;
              };
            };
          };
        }
      )
        .from("whatsapp_settings")
        .select("phone_number_id,access_token")
        .eq("user_id", user.id)
        .maybeSingle();
      setHasConfig(Boolean(data?.phone_number_id && data?.access_token));
    })();
  }, [user]);

  //  Il canale (ManyChat o Meta): decide se la casella si blocca. Non leggibile
  //  (403, 503, rete) = `null` = non blocca mai, decide il server all'invio (D12).
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    fetchCRM("/api/crm/whatsapp-canale")
      .then(async (res) => {
        if (!vivo) return;
        const j = res.ok ? ((await res.json()) as Partial<StatoCanale>) : null;
        setCanale(
          j && (j.canale === "manychat" || j.canale === "cloud") ? (j as StatoCanale) : null,
        );
      })
      .catch(() => vivo && setCanale(null));
    return () => {
      vivo = false;
    };
  }, [user]);

  //  Un solo orologio per tutta la pagina: ogni 30 s «da 25 min» e le ore rimaste restano vere.
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Caricamento messaggi + contatti
  //  ⚠️ I messaggi si leggono dal PIÙ NUOVO (DESC) e poi si capovolgono: con ASC
  //   si prendevano i 2000 più VECCHI e, superata quota, i nuovi sparivano.
  const reload = async () => {
    if (!user) return;
    //  Lo spinner solo al primo caricamento (`caricamento` parte vero): ogni
    //  risposta fa più ricariche, e l'elenco non deve lampeggiare né perdere un tocco.
    const [m, ct] = await Promise.all([
      tabella("whatsapp_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(2000),
      tabella("whatsapp_contacts").select("*").eq("user_id", user.id),
    ]);
    //  Errore di lettura (rete, RLS): si tengono i dati di prima, non si svuota l'elenco.
    if (m.error || ct.error) {
      setCaricamento(false);
      return;
    }
    const cts = (ct.data as WaContactRow[] | null) ?? [];
    setMessages(((m.data as WaMessageRow[] | null) ?? []).reverse());
    setContacts(cts);
    //  Se il cliente ha riscritto, il «solo modelli» forzato non vale più.
    setForzati((prima) => {
      const resta = Object.entries(prima).filter(
        ([tel, dal]) =>
          (cts.find((x) => x.phone_e164 === tel)?.ultimo_in_entrata_il ?? null) === dal,
      );
      return resta.length === Object.keys(prima).length ? prima : Object.fromEntries(resta);
    });
    setCaricamento(false);
    setLetture((n) => n + 1);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime: ricarica al volo su INSERT/UPDATE
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`wa-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void reload();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_contacts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void reload();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  //  Tutta la chat aperta, per telefono: i recenti non bastano per una chat vecchia.
  //  Si rilegge a ogni `reload` (`letture`) e si butta via se la risposta arriva tardi.
  useEffect(() => {
    if (!user || !activePhone) {
      setExtra(null);
      return;
    }
    let vivo = true;
    void (async () => {
      const { data } = await tabella("whatsapp_messages")
        .select("*")
        .eq("user_id", user.id)
        .or(filtroNumero(activePhone))
        .order("created_at", { ascending: false })
        .limit(500);
      if (vivo)
        setExtra({ phone: activePhone, righe: ((data as WaMessageRow[] | null) ?? []).reverse() });
    })();
    return () => {
      vivo = false;
    };
  }, [user, activePhone, letture]);

  /** I recenti e la chat aperta, senza doppioni per `id`, dal più vecchio. */
  const tutti = useMemo<WaMessageRow[]>(() => {
    if (!extra) return messages;
    const noti = new Set(messages.map((x) => x.id));
    const nuovi = extra.righe.filter((x) => !noti.has(x.id));
    if (nuovi.length === 0) return messages;
    return [...messages, ...nuovi].sort((x, y) => ms(x.created_at) - ms(y.created_at));
  }, [messages, extra]);

  // Costruisco l'elenco chat: una per phone unico (interlocutore = "altro" rispetto a noi)
  const chats = useMemo<ChatItem[]>(() => {
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
        unread: c.unread_count || 0,
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
          unread: 0,
        };
        map.set(key, item);
      }
      const suoi = perChat.get(key);
      if (suoi) suoi.push(m);
      else perChat.set(key, [m]);
      if (!item.lastMessage || new Date(m.created_at) > new Date(item.lastMessage.created_at)) {
        item.lastMessage = m;
      }
    }

    // scheda, «Da rispondere», finestra di 24 ore, STOP (le regole sono in stato.ts)
    for (const item of map.values()) {
      //  La scheda scelta vince; altrimenti per telefono SOLO se ce n'è una sola (D18).
      let lead = item.leadId ? (leads.find((l) => l.id === item.leadId) ?? null) : null;
      let senzaScheda = false;
      let schedaAmbigua = false;
      if (!lead) {
        const e = schedaUnica(leads, item.phone);
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
      const dr = calcolaDaRispondere({ contatto, messaggi, adesso });
      item.daRispondere = {
        attesa: dr.attesa,
        dal: dr.dal,
        anteprima: dr.anteprima,
        vecchia: dr.vecchia,
      };
      const f = finestra24({ contatto, messaggi, adesso });
      item.finestra = { aperta: f.aperta, frase: f.frase };
    }

    // ordina per ultimo messaggio
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastMessage
        ? new Date(a.lastMessage.created_at).getTime()
        : a.contact?.last_message_at
          ? new Date(a.contact.last_message_at).getTime()
          : 0;
      const tb = b.lastMessage
        ? new Date(b.lastMessage.created_at).getTime()
        : b.contact?.last_message_at
          ? new Date(b.contact.last_message_at).getTime()
          : 0;
      return tb - ta;
    });
  }, [tutti, contacts, leads, adesso, ottimistici]);

  /** «Da rispondere»: chi aspetta da più tempo sta sopra (D17). */
  const daRispondere = useMemo<ChatItem[]>(
    () =>
      ordinaDaRispondere(
        chats
          .filter((c) => c.daRispondere?.attesa)
          .map((chat) => ({ dal: chat.daRispondere?.dal ?? null, chat })),
      ).map((x) => x.chat),
    [chats],
  );

  const visibili = useMemo(() => {
    return chats.filter((c) => {
      if (filtro === "unread" && c.unread === 0) return false;
      if (filtro === "with-lead" && !c.lead) return false;
      if (filtro === "unknown" && c.lead) return false;
      if (ricerca.trim()) {
        const q = ricerca.toLowerCase();
        const name = `${c.lead?.data.nome ?? ""} ${c.lead?.data.cognome ?? ""}`.toLowerCase();
        const nomeWa = (c.contact?.display_name ?? "").toLowerCase();
        if (!name.includes(q) && !nomeWa.includes(q) && !c.phone.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [chats, filtro, ricerca]);

  const attiva = useMemo<ChatItem | null>(() => {
    if (!activePhone) return null;
    return chats.find((c) => c.phone === activePhone) ?? null;
  }, [activePhone, chats]);

  const activeMessages = useMemo<WaMessageRow[]>(() => {
    if (!activePhone) return [];
    return tutti.filter((m) => {
      const peer = m.direction === "inbound" ? m.from_number : m.to_number;
      const key = peer?.startsWith("+") ? peer : `+${peer}`;
      return key === activePhone;
    });
  }, [tutti, activePhone]);

  // Mark contact as read quando apro la chat
  //  ⚠️ Scrive SOLO `unread_count`: aprire non è rispondere (la chat resta in «Da rispondere»).
  //  Le dipendenze sono i due valori, non l'oggetto `attiva`: il timer lo rifà ogni 30 s.
  const phoneLetto = attiva?.contact?.phone_e164;
  const nonLetti = attiva?.contact?.unread_count ?? 0;
  useEffect(() => {
    if (!user || !phoneLetto || nonLetti === 0) return;
    //  ⚠️ Il costruttore di Supabase parte solo quando lo si aspetta (`then`): un
    //   `void costruttore` non manda niente. Per questo c'è l'`await`.
    void (async () => {
      await tabella("whatsapp_contacts")
        .update({ unread_count: 0 })
        .eq("user_id", user.id)
        .eq("phone_e164", phoneLetto);
    })();
  }, [user, phoneLetto, nonLetti]);

  /** ── I SEGNAPOSTO RIMASTI NELLA BOZZA ────────────────────────────────────
   *  Il testo qui dentro parte così com'è: se è stato incollato da un modello,
   *  un `{nome}` non sostituito arriva scritto alla lettera sul telefono del
   *  cliente. Si vede prima di premere invio, e all'invio si chiede conferma. */
  const residuiBozza = useMemo(() => segnapostiResidui(bozza), [bozza]);

  /** Cosa mostra la casella (D12): blocca solo se il canale è letto, è Meta e mancano le chiavi. */
  const stato = statoCasella({
    stop: attiva?.stop ?? false,
    finestraAperta: attiva?.finestra?.aperta ?? true,
    forzaModelli: attiva ? attiva.phone in forzati : false,
    canale: canale?.canale ?? null,
    chiaviMeta: hasConfig === true,
  });
  const forzaModelli = useMemo(
    () => Object.fromEntries(Object.keys(forzati).map((tel) => [tel, true])),
    [forzati],
  );

  /** Fa uscire la chat da «Da rispondere» subito e lascia che la ricarica lo confermi. */
  const rispostoOra = async (tel: string) => {
    setOttimistici((prima) => ({ ...prima, [tel]: Date.now() }));
    await reload().catch(() => undefined);
    setOttimistici((prima) => {
      const resto = { ...prima };
      delete resto[tel];
      return resto;
    });
  };

  /** ── LA STRADA UNICA DELL'INVIO (testo e modelli) ──────────────────────────
   *  Mai un messaggio tecnico a schermo: si mostra la frase del server, altrimenti
   *  «Invio non riuscito, riprova». Fuori dalle 24 ore la casella passa ai modelli
   *  e la bozza resta com'è. Una chiamata alla volta (doppio clic, Invio ripetuto). */
  const manda = async (invio: {
    body?: string;
    templateName?: string;
    templateLang?: string;
    templateParams?: string[];
  }): Promise<boolean> => {
    if (!user || !attiva || inviandoRef.current) return false;
    inviandoRef.current = true;
    setInviando(true);
    const tel = attiva.phone;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Sessione scaduta");
        return false;
      }
      const res = await fetch("/api/whatsapp-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: tel, ...invio, leadId: attiva.leadId }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        category?: string;
        message?: string;
      } | null;
      if (res.ok && json?.ok) {
        await rispostoOra(tel);
        return true;
      }
      const frase = typeof json?.message === "string" && json.message.trim() ? json.message : "";
      if (json?.category === "outside_24h_window") {
        setForzati((prima) => ({ ...prima, [tel]: attiva.contact?.ultimo_in_entrata_il ?? null }));
        toast.error("Sono passate più di 24 ore: scegli un modello");
      } else if (res.status === 429 || json?.error === "riprova_fra_poco") {
        toast.error("Un attimo, riprova");
      } else {
        toast.error(frase || FRASE_INVIO);
      }
      return false;
    } catch {
      toast.error(FRASE_INVIO);
      return false;
    } finally {
      inviandoRef.current = false;
      setInviando(false);
    }
  };

  const invia = async () => {
    if (!user || !bozza.trim() || !attiva) return;
    if (stato === "configura") {
      toast.error("Configura prima le credenziali WhatsApp in Impostazioni → WhatsApp");
      return;
    }
    if (
      residuiBozza.length > 0 &&
      !confirm(
        `Nel messaggio ci sono segnaposto non sostituiti: ${residuiBozza.join("  ")}\n\n` +
          "Arriverebbero scritti così al cliente. Inviare lo stesso?",
      )
    )
      return;
    //  Si svuota solo se nel frattempo nessuno ha scritto altro nella casella.
    const inviata = bozza;
    if (await manda({ body: bozza.trim() })) setBozza((b) => (b === inviata ? "" : b));
  };

  const inviaModello = async (m: { nome: string; lingua: string; parametri: string[] }) => {
    //  L'errore l'ha già mostrato `manda`; si lancia perché la casella non creda che sia partito.
    const partito = await manda({
      templateName: m.nome,
      templateLang: m.lingua,
      templateParams: m.parametri,
    });
    if (!partito) throw new Error("invio non riuscito");
  };

  /** «Risposto / Fatto»: il cliente esce senza mandare nulla. L'ora la scrive il database (D3). */
  const segnaFatto = async () => {
    if (!user || !attiva) return;
    const tel = attiva.phone;
    try {
      const { data, error } = await chiamaFunzione("whatsapp_segna_fatto", { p_phone: tel });
      if (error) {
        toast.error(
          mancaFunzione(error)
            ? "Manca l'aggiornamento del database: avvisa il titolare"
            : "Non sono riuscito a segnare «Fatto», riprova",
        );
        return;
      }
      if (data === false) {
        toast.error("Non sono riuscito a segnare «Fatto»: questa chat non ha un contatto");
        return;
      }
      toast.success("Fatto: la chat non è più in «Da rispondere»");
      await rispostoOra(tel);
    } catch {
      toast.error("Non sono riuscito a segnare «Fatto», riprova");
    }
  };

  /** «Abbina a una scheda»: scrive `lead_id` sul contatto (RLS dell'utente).
   *  Se non riesce mostra UN toast e LANCIA: chi la chiama (la finestra) resta aperto. */
  const abbina = async (leadId: string, phone?: string) => {
    const non = (frase: string): never => {
      toast.error(frase);
      throw new Error("abbinamento non riuscito");
    };
    if (!user || !attiva) return non("Abbinamento non riuscito, riprova");
    //  La finestra mostra una chat: se nel frattempo ne è aperta un'altra, non si abbina quella sbagliata.
    if (phone !== undefined && digitsOnly(phone) !== digitsOnly(attiva.phone))
      return non("La chat aperta è cambiata: riprova l'abbinamento");
    if (!attiva.contact) return non("Questa chat non ha ancora un contatto: non posso abbinarla");
    let riuscito = false;
    try {
      //  `select("id")`: con la RLS un update che non tocca righe non dà errore.
      const { data, error } = await tabella("whatsapp_contacts")
        .update({ lead_id: leadId })
        .eq("id", attiva.contact.id)
        .eq("user_id", user.id)
        .select("id");
      riuscito = !error && Array.isArray(data) && data.length > 0;
    } catch {
      riuscito = false;
    }
    if (!riuscito) return non("Abbinamento non riuscito, riprova");
    toast.success("Chat abbinata alla scheda");
    await reload().catch(() => undefined);
  };

  /** Cambio stato del lead — stesso comportamento della pagina Leads:
   *  se lo stato richiede campi extra apre QuickStatusDialog,
   *  altrimenti applica direttamente e precompila il template WA nel composer. */
  const cambiaStato = async (newStatus: LeadStatus) => {
    if (!attiva?.lead) return;
    if (newStatus === attiva.lead.data.stato) return;
    //  Le tre chiusure vinte hanno la loro finestra, che scrive stato, importi
    //  e modo di consegna in un salvataggio solo. ⚠️ Il ramo va PRIMA di
    //  `requiresAnyDialog` e non scrive niente da sé: vedi ChiusuraDialog.
    if (opz.intercettaChiusura(attiva.lead, newStatus)) return;
    if (requiresAnyDialog(newStatus)) {
      opz.apriStatoRapido(attiva.lead, newStatus);
      return;
    }
    try {
      await updateLead(attiva.lead.id, { stato: newStatus });
      const refreshed = { ...attiva.lead, data: { ...attiva.lead.data, stato: newStatus } };
      //  Il nome del consulente serve alla firma: senza, la riga sparisce e il
      //  messaggio si chiude con "A presto," e basta.
      const consulente = consultants.find((c) => c.id === refreshed.data.consulenteId)?.data.nome;
      const template = getWhatsAppMessageForStatus(refreshed, consulente);
      setBozza(template);
      toast.success(`Stato → "${LEAD_STATUS_LABEL[newStatus]}". Template precompilato.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore cambio stato");
    }
  };

  /** Elimina TUTTI i messaggi WA della chat corrente lato CRM (non tocca WhatsApp del destinatario). */
  const elimina = async () => {
    if (!user || !attiva) return;
    if (
      !confirm(
        `Eliminare tutti i messaggi della chat con ${attiva.phone}?\n\nQuesta azione non può essere annullata. Verrà cancellato solo lato CRM, il destinatario manterrà la sua copia su WhatsApp.`,
      )
    )
      return;
    try {
      // Cancello dai messaggi le righe in cui peer = activePhone (sia inbound che outbound).
      const { error } = await tabella("whatsapp_messages")
        .delete()
        .eq("user_id", user.id)
        .or(filtroNumero(attiva.phone));
      if (error) throw new Error(error.message);
      // Azzero il contatto, se esiste: anche l'ultimo messaggio del cliente e il «risposto»,
      // altrimenti una chat eliminata resterebbe in «Da rispondere» (D19).
      let azzerato = true;
      if (attiva.contact) {
        const azzera = (valori: Record<string, unknown>) =>
          tabella("whatsapp_contacts")
            .update(valori)
            .eq("user_id", user.id)
            .eq("phone_e164", attiva.phone);
        let r = await azzera({
          unread_count: 0,
          last_message_at: null,
          ultimo_in_entrata_il: null,
          risposto_il: null,
        });
        //  Colonne non ancora create: si riprova col solo set di prima.
        if (r.error && mancaColonna(r.error)) {
          r = await azzera({ unread_count: 0, last_message_at: null });
        }
        if (r.error) azzerato = false;
      }
      //  Un solo esito a schermo: o l'errore o «Chat eliminata».
      if (azzerato) toast.success("Chat eliminata");
      else toast.error("Messaggi eliminati, ma il contatto non si è azzerato: riprova");
      setActivePhone(null);
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    }
  };

  return {
    chats,
    daRispondere,
    visibili,
    filtro,
    setFiltro,
    ricerca,
    setRicerca,
    attiva,
    //  Un uuid è l'id di un contatto (T11 apre con `?chat=`), altrimenti è un telefono.
    apri: (chatIdOPhone: string) =>
      setActivePhone(contacts.find((c) => c.id === chatIdOPhone)?.phone_e164 ?? chatIdOPhone),
    messaggi: activeMessages,
    caricamento,
    canale,
    stato,
    bozza,
    setBozza,
    residuiBozza,
    invia,
    inviaModello,
    inviando,
    segnaFatto,
    abbina,
    elimina,
    forzaModelli,
    cambiaStato,
    hasConfig,
  };
}
