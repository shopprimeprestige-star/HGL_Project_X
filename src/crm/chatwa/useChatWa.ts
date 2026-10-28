/** ── LA CHAT WHATSAPP · DATI, EFFETTI E AZIONI DELLA PAGINA ────────────────
 *
 *  Commessa 2026-10-28, T6: il corpo "senza vista" di `CRM.whatsapp.tsx`, spostato
 *  qui senza cambiare comportamento. T7 ci aggiunge «Da rispondere», finestra,
 *  canale, invio dei modelli, «Fatto», abbinamento.
 *
 *  Gli effetti, perché nello spostamento non ne sparisca uno:
 *   1. carica i modelli di testo salvati (servono a otto pagine, non solo all'editor);
 *   2. legge le chiavi Meta (`whatsapp_settings`) → `hasConfig`;
 *   3. carica messaggi + contatti al montaggio e cambio utente (`reload`);
 *   4. realtime su `whatsapp_messages` e `whatsapp_contacts` → `reload`;
 *   5. segna letto il contatto quando si apre una chat con `unread_count > 0`.
 *  (Lo scorrimento in basso dei messaggi sta in `Conversazione`, dov'è il suo elemento.)
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { supabase } from "@/integrations/supabase/client";
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/crm/types";
import { requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { caricaModelliSalvati } from "@/crm/EditorMessaggi";
import { getWhatsAppMessageForStatus, segnapostiResidui } from "@/crm/whatsapp";
import type { ChatItem, ChatWaApi, FiltroChat, WaContactRow, WaMessageRow } from "./tipi";

function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function phonesMatch(a: string, b: string): boolean {
  const x = digitsOnly(a);
  const y = digitsOnly(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // tolleranza prefisso internazionale: matcha sugli ultimi 9 cifre
  return x.slice(-9) === y.slice(-9);
}

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

  // Caricamento messaggi + contatti
  const reload = async () => {
    if (!user) return;
    setCaricamento(true);
    const [{ data: msgs }, { data: cts }] = await Promise.all([
      (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (
                k: string,
                v: string,
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean },
                ) => {
                  limit: (n: number) => Promise<{ data: WaMessageRow[] | null }>;
                };
              };
            };
          };
        }
      )
        .from("whatsapp_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(2000),
      (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (k: string, v: string) => Promise<{ data: WaContactRow[] | null }>;
            };
          };
        }
      )
        .from("whatsapp_contacts")
        .select("*")
        .eq("user_id", user.id),
    ]);
    setMessages(msgs ?? []);
    setContacts(cts ?? []);
    setCaricamento(false);
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

  // Costruisco l'elenco chat: una per phone unico (interlocutore = "altro" rispetto a noi)
  const chats = useMemo<ChatItem[]>(() => {
    const map = new Map<string, ChatItem>();

    // partenza: contatti
    for (const c of contacts) {
      const lead = c.lead_id ? (leads.find((l) => l.id === c.lead_id) ?? null) : null;
      const linkedLead =
        lead ?? leads.find((l) => phonesMatch(l.data.telefono || "", c.phone_e164)) ?? null;
      map.set(c.phone_e164, {
        phone: c.phone_e164,
        leadId: linkedLead?.id ?? c.lead_id ?? null,
        lead: linkedLead,
        contact: c,
        lastMessage: null,
        unread: c.unread_count || 0,
      });
    }

    // aggiungo dai messaggi (per phone "interlocutore")
    for (const m of messages) {
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
        const linkedLead = leads.find((l) => phonesMatch(l.data.telefono || "", key)) ?? null;
        item = {
          phone: key,
          leadId: m.lead_id ?? linkedLead?.id ?? null,
          lead: linkedLead,
          contact: null,
          lastMessage: null,
          unread: 0,
        };
        map.set(key, item);
      }
      if (!item.lastMessage || new Date(m.created_at) > new Date(item.lastMessage.created_at)) {
        item.lastMessage = m;
      }
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
  }, [messages, contacts, leads]);

  const visibili = useMemo(() => {
    return chats.filter((c) => {
      if (filtro === "unread" && c.unread === 0) return false;
      if (filtro === "with-lead" && !c.lead) return false;
      if (filtro === "unknown" && c.lead) return false;
      if (ricerca.trim()) {
        const q = ricerca.toLowerCase();
        const name = `${c.lead?.data.nome ?? ""} ${c.lead?.data.cognome ?? ""}`.toLowerCase();
        if (!name.includes(q) && !c.phone.toLowerCase().includes(q)) return false;
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
    return messages.filter((m) => {
      const peer = m.direction === "inbound" ? m.from_number : m.to_number;
      const key = peer?.startsWith("+") ? peer : `+${peer}`;
      return key === activePhone;
    });
  }, [messages, activePhone]);

  // Mark contact as read quando apro la chat
  useEffect(() => {
    if (!user || !attiva?.contact || attiva.contact.unread_count === 0) return;
    void (
      supabase as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            eq: (
              k: string,
              v: string,
            ) => {
              eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        };
      }
    )
      .from("whatsapp_contacts")
      .update({ unread_count: 0 })
      .eq("user_id", user.id)
      .eq("phone_e164", attiva.contact.phone_e164);
  }, [user, attiva]);

  /** ── I SEGNAPOSTO RIMASTI NELLA BOZZA ────────────────────────────────────
   *  Il testo qui dentro parte così com'è: se è stato incollato da un modello,
   *  un `{nome}` non sostituito arriva scritto alla lettera sul telefono del
   *  cliente. Si vede prima di premere invio, e all'invio si chiede conferma. */
  const residuiBozza = useMemo(() => segnapostiResidui(bozza), [bozza]);

  const invia = async () => {
    if (!user || !bozza.trim() || !attiva) return;
    if (!hasConfig) {
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
    setInviando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessione scaduta");
      const res = await fetch("/api/whatsapp-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: attiva.phone,
          body: bozza.trim(),
          leadId: attiva.leadId,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok) {
        toast.error(`Invio fallito: ${json.message || json.error || `HTTP ${res.status}`}`);
        return;
      }
      setBozza("");
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore invio");
    } finally {
      setInviando(false);
    }
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
      const peerDigits = attiva.phone.replace(/^\+/, "");
      const { error } = await (
        supabase as unknown as {
          from: (t: string) => {
            delete: () => {
              eq: (
                k: string,
                v: string,
              ) => {
                or: (cond: string) => Promise<{ error: { message: string } | null }>;
              };
            };
          };
        }
      )
        .from("whatsapp_messages")
        .delete()
        .eq("user_id", user.id)
        .or(
          `from_number.eq.${attiva.phone},to_number.eq.${attiva.phone},from_number.eq.${peerDigits},to_number.eq.${peerDigits}`,
        );
      if (error) throw new Error(error.message);
      // Reset unread count del contatto, se esiste
      if (attiva.contact) {
        await (
          supabase as unknown as {
            from: (t: string) => {
              update: (v: Record<string, unknown>) => {
                eq: (
                  k: string,
                  v: string,
                ) => {
                  eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
                };
              };
            };
          }
        )
          .from("whatsapp_contacts")
          .update({ unread_count: 0, last_message_at: null })
          .eq("user_id", user.id)
          .eq("phone_e164", attiva.phone);
      }
      toast.success("Chat eliminata");
      setActivePhone(null);
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    }
  };

  // shortcut: le parti del contratto che oggi non esistono sono valori neutri
  // (nessuna «Da rispondere», canale non letto, azioni vuote), T7 le scrive; il
  // comportamento visibile è quello di prima.
  return {
    chats,
    daRispondere: [],
    visibili,
    filtro,
    setFiltro,
    ricerca,
    setRicerca,
    attiva,
    apri: setActivePhone,
    messaggi: activeMessages,
    caricamento,
    canale: null,
    // stesso blocco di prima: senza chiavi Meta (o ancora non lette) non si invia
    stato: hasConfig ? "libera" : "configura",
    bozza,
    setBozza,
    residuiBozza,
    invia,
    inviaModello: async () => {},
    inviando,
    segnaFatto: async () => {},
    abbina: async () => {},
    elimina,
    forzaModelli: {},
    cambiaStato,
    hasConfig,
  };
}
