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
import { calcolaDaChiamare, telefonoE164 } from "./daChiamare";
import { combaciaRicerca, passaFiltro } from "./cercaChat";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchCRM, useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { supabase } from "@/integrations/supabase/client";
import { LEAD_STATUS_LABEL, type Lead, type LeadData, type LeadStatus } from "@/crm/types";
import { patchEsito } from "@/crm/importa/chi-chiamare";
import { requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { caricaModelliSalvati } from "@/crm/EditorMessaggi";
import { getWhatsAppMessageForStatus, segnapostiResidui } from "@/crm/whatsapp";
import type { StatoCanale } from "@/crm/prova-modelli";
import {
  daRispondere as calcolaDaRispondere,
  type EventoDb,
  eventoDaIgnorare,
  finestra24,
  leggiContattiAPagine,
  leggiSenzaDoppioni,
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
  is(colonna: string, valore: null): Query;
  range(da: number, a: number): Query;
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

/** Il messaggio più nuovo/i più recenti dell'utente, senza i doppioni del ponte (`duplicato_di` vuoto). */
const messaggiRecenti = (userId: string, colonne: string, n: number) => (filtra: boolean) => {
  const q = tabella("whatsapp_messages").select(colonne).eq("user_id", userId);
  return (filtra ? q.is("duplicato_di", null) : q)
    .order("created_at", { ascending: false })
    .limit(n);
};

const ms = (x: string | null | undefined) => (x ? Date.parse(x) : NaN);

const FRASE_INVIO = "Invio non riuscito, riprova";

/** ── UNA RICHIESTA APPESA NON BLOCCA LA PAGINA (29/10/2026) ──────────────────
 *  Sul telefono, a rete appena tornata, una richiesta può restare appesa senza
 *  mai rispondere: il tasto «Aggiorna» resterebbe disabilitato e ogni ricarica
 *  dopo resterebbe in fila per sempre. Ogni attesa di rete ha un tetto. */
const LIMITE_RETE = 10_000;
/** Una ricarica «in corso» da più di così si considera persa: la prossima parte lo stesso. */
const LIMITE_RICARICA = 30_000;
/** Con l'errore che persiste, la sessione si rinnova al massimo una volta ogni tanto. */
const PAUSA_RINNOVO = 60_000;

function conTempo<T>(p: PromiseLike<T>, ms = LIMITE_RETE): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const scade = new Promise<never>((_, no) => {
    t = setTimeout(() => no(new Error("tempo scaduto")), ms);
  });
  return Promise.race([Promise.resolve(p), scade]).finally(() => clearTimeout(t));
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
  const [canale, setCanale] = useState<StatoCanale | null>(null);
  /** La chat aperta, letta per intero: i `messages` sono solo i 2000 più recenti. */
  const [extra, setExtra] = useState<{ phone: string; righe: WaMessageRow[] } | null>(null);
  const [letture, setLetture] = useState(0);
  /** Ora dell'ultima lettura riuscita, ed errore dell'ultima fallita (si mostrano in alto). */
  const [aggiornatoIl, setAggiornatoIl] = useState<number | null>(null);
  const [erroreLettura, setErroreLettura] = useState<string | null>(null);
  const [aggiornando, setAggiornando] = useState(false);
  /** «Aggiorna» a mano: riapre il canale e rilegge (lo imposta l'effetto del tempo reale). */
  const forzaRef = useRef<(() => Promise<void>) | null>(null);
  /** Ultimo rinnovo della sessione dopo un errore: con la rete giù non se ne fa uno a ogni giro. */
  const rinnovatoRef = useRef(0);
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
    //  Una lettura appesa o caduta vale come una lettura in errore (`null`).
    const leggi = () =>
      conTempo(
        Promise.all([
          //  Senza i doppioni del ponte: non consumano posti dei 2000 (`leggiSenzaDoppioni`).
          leggiSenzaDoppioni(messaggiRecenti(user.id, "*", 2000)),
          //  I contatti a pagine di 1000: una richiesta sola ne darebbe 1000 in silenzio.
          leggiContattiAPagine((da, a) =>
            tabella("whatsapp_contacts")
              .select("*")
              .eq("user_id", user.id)
              .order("id", { ascending: true })
              .range(da, a),
          ),
        ]),
      ).catch(() => null);
    let letti = await leggi();
    /*  ── LA SESSIONE SCADUTA SUL TELEFONO (29/10/2026) ──────────────────────
        Il titolare vedeva sul telefono solo le chat del giorno prima. Con il CRM
        lasciato aperto in un browser dentro un'app, i timer si fermano e la
        sessione scade senza rinnovarsi: ogni lettura tornava errore e la pagina
        teneva, ZITTA, i dati vecchi. Ora: al primo errore si rinnova la sessione
        e si riprova; se fallisce ancora, l'errore si mostra in alto con «Aggiorna». */
    if (
      (!letti || letti[0].error || letti[1].error) &&
      Date.now() - rinnovatoRef.current > PAUSA_RINNOVO
    ) {
      rinnovatoRef.current = Date.now();
      await conTempo(supabase.auth.refreshSession()).catch(() => null);
      letti = await leggi();
    }
    //  Errore di lettura (rete, RLS): si tengono i dati di prima, non si svuota l'elenco.
    if (!letti || letti[0].error || letti[1].error) {
      setErroreLettura(
        "Chat non aggiornate: connessione o accesso scaduto. Tocca «Aggiorna» o ricarica la pagina.",
      );
      setCaricamento(false);
      return;
    }
    const [m, ct] = letti;
    //  shortcut: l'avviso dei contatti troncati riusa il banner d'errore in alto (con «Aggiorna»);
    //  se serve un avviso a parte, aggiungere un campo a `ChatWaApi`.
    setErroreLettura(
      ct.troncato
        ? "Ci sono più di 5000 contatti: se ne vedono solo i primi 5000, alcune chat potrebbero mancare."
        : null,
    );
    setAggiornatoIl(Date.now());
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

  /** ── I MESSAGGI NUOVI ARRIVANO SEMPRE (28/10/2026) ──────────────────────
   *  Il titolare riceveva messaggi che nella chat non comparivano finché non
   *  ricaricava la pagina. Il canale in tempo reale da solo non basta:
   *   - se si iscrive prima che la sessione sia passata al socket, entra come
   *     anonimo e la RLS (`auth.uid() = user_id`) gli nasconde ogni riga;
   *   - sul telefono, con lo schermo spento o l'app in secondo piano, il socket
   *     muore e non si riapre da solo.
   *  Quindi: la sessione si passa al socket PRIMA di iscriversi; se il canale
   *  cade si riapre; appena iscritto si rilegge (quello perso nel frattempo);
   *  si rilegge al ritorno sulla pagina; e ogni 15 s un controllo leggero
   *  (l'ultimo messaggio e l'ultimo contatto cambiato) fa da rete di sicurezza.
   *  Le ricariche si mettono in fila: mai due insieme. */
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    //  `inCorso` è l'ora d'inizio della ricarica in corso (0 = nessuna). Una ricarica
    //  appesa da più di LIMITE_RICARICA non tiene più in fila le altre: la sua
    //  fine, se mai arriva, non tocca più niente (`turno`).
    let inCorso = 0;
    let turno = 0;
    let ancora = false;
    const ricarica = async () => {
      if (inCorso && Date.now() - inCorso < LIMITE_RICARICA) {
        ancora = true;
        return;
      }
      inCorso = Date.now();
      const mio = ++turno;
      try {
        await reloadRef.current();
      } catch {
        //  Rete caduta: si riprova al prossimo segnale (canale, controllo, ritorno sulla pagina).
      } finally {
        if (mio === turno) inCorso = 0;
        if (mio === turno && ancora && vivo) {
          ancora = false;
          void ricarica();
        }
      }
    };

    let ch: ReturnType<typeof supabase.channel> | null = null;
    let riprova: ReturnType<typeof setTimeout> | null = null;
    //  Ogni `apri` ha il suo numero: se mentre aspetta la sessione ne parte un altro
    //  («Aggiorna», ritorno sulla pagina, ritento dei 5 s), il primo si ritira senza
    //  aprire niente. Così di canali vivi ce n'è sempre uno solo.
    let generazione = 0;
    const apri = async () => {
      if (!vivo) return;
      const mia = ++generazione;
      const { data } = await conTempo(supabase.auth.getSession());
      const token = data.session?.access_token;
      if (token) await conTempo(supabase.realtime.setAuth(token));
      if (!vivo || mia !== generazione) return;
      const questo = supabase
        .channel(`wa-${user.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "whatsapp_messages",
            filter: `user_id=eq.${user.id}`,
          },
          //  Lo storico del ponte (messaggi vecchi) non riavvia la lettura: il controllo ogni 15 s resta la rete.
          (e: EventoDb) => {
            if (!eventoDaIgnorare("whatsapp_messages", e, Date.now())) void ricarica();
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
          (e: EventoDb) => {
            if (!eventoDaIgnorare("whatsapp_contacts", e, Date.now())) void ricarica();
          },
        );
      ch = questo;
      questo.subscribe((stato) => {
        //  ⚠️ `removeChannel` richiama la callback del canale tolto con CLOSED:
        //   contano solo gli stati del canale attuale, sennò si riapre in giro ogni 5 s.
        if (!vivo || ch !== questo) return;
        if (stato === "SUBSCRIBED") void ricarica();
        else if (stato === "CHANNEL_ERROR" || stato === "TIMED_OUT" || stato === "CLOSED") {
          if (riprova) return;
          riprova = setTimeout(() => {
            riprova = null;
            ch = null;
            void supabase.removeChannel(questo);
            void apri().catch(() => {});
          }, 5_000);
        }
      });
    };
    void apri().catch(() => {});

    //  Rete di sicurezza: una riga sola per tabella, si rilegge tutto solo se è cambiato qualcosa.
    let impronta = "";
    let primo = true;
    const controlla = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const [m, c] = await Promise.all([
        leggiSenzaDoppioni(messaggiRecenti(user.id, "id,created_at", 1)),
        tabella("whatsapp_contacts")
          .select("id,updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);
      if (!vivo) return;
      //  Errore anche qui (sessione scaduta?): la ricarica rinnova la sessione e lo mostra.
      if (m.error || c.error) {
        void ricarica();
        return;
      }
      const ora = JSON.stringify([m.data, c.data]);
      if (ora !== impronta) {
        impronta = ora;
        if (!primo) void ricarica();
      }
      primo = false;
    };
    const controllaZitto = () => controlla().catch(() => {});
    //  «Aggiorna»: sessione rinnovata, canale riaperto da capo, tutto riletto.
    forzaRef.current = async () => {
      await conTempo(supabase.auth.refreshSession()).catch(() => null);
      if (riprova) {
        clearTimeout(riprova);
        riprova = null;
      }
      const vecchio = ch;
      ch = null;
      if (vecchio) void supabase.removeChannel(vecchio);
      void apri().catch(() => {});
      await ricarica();
    };
    void controllaZitto();
    const giro = setInterval(() => void controllaZitto(), 15_000);
    //  Al ritorno sulla pagina: se è stata ferma a lungo (telefono in tasca) il
    //  canale è quasi certamente morto: si riapre tutto come con «Aggiorna».
    let ultimoGiro = Date.now();
    const torna = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      const fermo = Date.now() - ultimoGiro > 60_000;
      ultimoGiro = Date.now();
      if (fermo && forzaRef.current) void forzaRef.current();
      else void ricarica();
    };
    const battito = setInterval(() => {
      //  I timer sospesi non battono: un buco di oltre un minuto vuol dire pagina congelata.
      if (Date.now() - ultimoGiro > 60_000) torna();
      else ultimoGiro = Date.now();
    }, 20_000);
    const pagina = typeof document !== "undefined";
    if (pagina) {
      document.addEventListener("visibilitychange", torna);
      window.addEventListener("focus", torna);
      window.addEventListener("online", torna);
      //  Pagina ripresa dalla cache del browser (indietro/avanti, app riaperta).
      window.addEventListener("pageshow", torna);
    }
    return () => {
      vivo = false;
      forzaRef.current = null;
      clearInterval(giro);
      clearInterval(battito);
      if (riprova) clearTimeout(riprova);
      if (pagina) {
        document.removeEventListener("visibilitychange", torna);
        window.removeEventListener("focus", torna);
        window.removeEventListener("online", torna);
        window.removeEventListener("pageshow", torna);
      }
      if (ch) void supabase.removeChannel(ch);
    };
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
      const { data } = await leggiSenzaDoppioni((filtra) => {
        const q = tabella("whatsapp_messages")
          .select("*")
          .eq("user_id", user.id)
          .or(filtroNumero(activePhone));
        return (filtra ? q.is("duplicato_di", null) : q)
          .order("created_at", { ascending: false })
          .limit(500);
      });
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

    //  ── CHI ASPETTA SU WHATSAPP MA NEL CRM NON HA UNA CHAT (28/10/2026) ──
    //   La setter scrive spesso dal WhatsApp del telefono: quei lead non hanno
    //   messaggi qui. Se sono in attesa da più di 10 ore entrano lo stesso,
    //   così compaiono in «Da chiamare» e si chiamano dal tasto in alto.
    const ultime9 = new Set([...map.keys()].map((k) => k.replace(/\D/g, "").slice(-9)));
    for (const l of leads) {
      if (!calcolaDaChiamare({ dati: l.data, messaggi: [], adesso: new Date(adesso) }).si) continue;
      const tel = telefonoE164(l.data?.telefono);
      if (!tel || ultime9.has(tel.replace(/\D/g, "").slice(-9))) continue;
      ultime9.add(tel.replace(/\D/g, "").slice(-9));
      map.set(tel, {
        phone: tel,
        leadId: l.id,
        lead: null,
        contact: null,
        lastMessage: null,
        unread: 0,
      });
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

    // ordina per ultimo movimento, come WhatsApp: il messaggio più recente fra quelli
    // caricati, l'ultimo messaggio del contatto e l'ultima entrata del cliente.
    const t = (v: string | null | undefined) => {
      const n = ms(v);
      return Number.isFinite(n) ? n : 0;
    };
    const quando = (x: ChatItem) =>
      Math.max(
        t(x.lastMessage?.created_at),
        t(x.contact?.last_message_at),
        t(x.contact?.ultimo_in_entrata_il),
      );
    return Array.from(map.values()).sort((a, b) => quando(b) - quando(a));
  }, [tutti, contacts, leads, adesso, ottimistici]);

  /** «Da rispondere»: come su WhatsApp, l'ultima chat che si è mossa sta sopra
   *  (richiesta del titolare, 29/10/2026: prima stava sopra chi aspettava da più
   *  tempo, e un messaggio appena arrivato finiva in fondo). `chats` è già
   *  ordinato per ultimo messaggio, compresi quelli del ponte WhatsApp. */
  const daRispondere = useMemo<ChatItem[]>(
    () => chats.filter((c) => c.daRispondere?.attesa),
    [chats],
  );

  const visibili = useMemo(() => {
    return chats.filter((c) => {
      if (!passaFiltro(c, filtro)) return false;
      if (!combaciaRicerca(c, ricerca)) return false;
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

  /** Cambio stato di UN lead (anche non aperto: dalla riga dell'elenco) — stesso comportamento
   *  della pagina Leads e della coda dei lead importati: se lo stato richiede campi extra apre
   *  QuickStatusDialog, altrimenti `updateLead` scrive stato, statoDal e statoPrecedente (e il
   *  contatore dei tentativi, `patchEsito`). Se è la chat aperta precompila anche il template WA.
   *  Il toast ha «Annulla»: rimette com'era, senza rinnovare `statoDal` (`annulla: true`). */
  const cambiaStatoLead = async (lead: Lead, newStatus: LeadStatus) => {
    if (newStatus === lead.data.stato) return;
    //  Le tre chiusure vinte hanno la loro finestra, che scrive stato, importi
    //  e modo di consegna in un salvataggio solo. ⚠️ Il ramo va PRIMA di
    //  `requiresAnyDialog` e non scrive niente da sé: vedi ChiusuraDialog.
    if (opz.intercettaChiusura(lead, newStatus)) return;
    if (requiresAnyDialog(newStatus)) {
      opz.apriStatoRapido(lead, newStatus);
      return;
    }
    try {
      if (!(await updateLead(lead.id, patchEsito(lead.data, newStatus)))) {
        toast.error("Stato NON salvato", {
          description: "La scheda in archivio è rimasta com'era. Riprova.",
        });
        return;
      }
      const nome = `${lead.data.nome ?? ""} ${lead.data.cognome ?? ""}`.trim() || "Lead";
      //  Com'era PRIMA, per «Annulla»: anche la data da cui valeva lo stato.
      const prima: Partial<LeadData> = {
        stato: lead.data.stato,
        noRispondeCount: Number(lead.data.noRispondeCount) || 0,
        statoPrecedente: lead.data.statoPrecedente,
        statoPrecedenteIl: lead.data.statoPrecedenteIl,
        statoDa: lead.data.statoDa,
        statoDal: lead.data.statoDal,
      };
      const annulla = {
        label: "Annulla",
        onClick: () =>
          void updateLead(lead.id, prima, { annulla: true }).then((ok) =>
            ok
              ? toast.success(`${nome}: tornato com'era`)
              : toast.error("Non sono riuscito a tornare indietro"),
          ),
      };
      if (lead.id === attiva?.lead?.id) {
        //  Il nome del consulente serve alla firma: senza, la riga sparisce e il
        //  messaggio si chiude con "A presto," e basta.
        const refreshed = { ...lead, data: { ...lead.data, stato: newStatus } };
        const consulente = consultants.find((c) => c.id === refreshed.data.consulenteId)?.data.nome;
        setBozza(getWhatsAppMessageForStatus(refreshed, consulente));
        toast.success(`Stato → "${LEAD_STATUS_LABEL[newStatus]}". Template precompilato.`, {
          action: annulla,
        });
      } else {
        toast.success(`${nome} → ${LEAD_STATUS_LABEL[newStatus]}`, { action: annulla });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore cambio stato");
    }
  };

  /** Cambio stato della chat aperta (intestazione della conversazione). */
  const cambiaStato = async (newStatus: LeadStatus) => {
    if (attiva?.lead) await cambiaStatoLead(attiva.lead, newStatus);
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
    aggiornatoIl,
    erroreLettura,
    aggiornando,
    aggiorna: async () => {
      if (!forzaRef.current || aggiornando) return;
      setAggiornando(true);
      try {
        await forzaRef.current();
      } finally {
        setAggiornando(false);
      }
    },
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
    cambiaStatoLead,
    hasConfig,
  };
}
