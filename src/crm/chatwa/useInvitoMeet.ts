/** ── L'INVITO AL MEET: LO STATO DEL TASTO E L'INVIO (31/10/2026) ────────────
 *  Le regole pure sono in invito-meet.ts. Qui quello che parla col mondo: il registro sul
 *  dispositivo e l'invio dalla chat del CRM.
 *  shortcut: l'invio rifà la chiamata a `/api/whatsapp-send` che fa `manda` in useChatWa. Quella
 *  funzione è legata alla chat APERTA e non è esportata, e useChatWa lo sta ottimizzando un'altra
 *  sessione; il corpo della richiesta e la strada sono identici, quindi il server registra il
 *  messaggio come per la casella. Da ricondurre a `manda(telefono, …)` quando perf/chat-veloce sarà
 *  unito a main. */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { oggiIso } from "@/crm/ui";
import { linkApriWhatsapp } from "./apriWhatsapp";
import {
  CHIAVE_INVITI,
  PROMEMORIA_LINK,
  invitoDiOggi,
  leggiRegistro,
  preparaInvito,
  registraInvito,
  stradaInvito,
  type ChatPerInvito,
  type ModoInvito,
  type RegistroInviti,
  type VoceInvito,
} from "./invito-meet";

const FRASE_INVIO = "Invio non riuscito, riprova";

const oraLocale = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
};
const giornoLocale = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : oggiIso(d);
};

/** Manda il testo dalla chat del CRM. `true` solo se è partito; gli errori li mostra lei. */
async function mandaDalCrm(telefono: string, leadId: string | null, testo: string) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Sessione scaduta");
      return "errore" as const;
    }
    const res = await fetch("/api/whatsapp-send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ to: telefono, body: testo, leadId }),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      category?: string;
      message?: string;
    } | null;
    if (res.ok && json?.ok) return "ok" as const;
    if (json?.category === "outside_24h_window") return "fuori_finestra" as const;
    if (res.status === 429 || json?.error === "riprova_fra_poco") toast.error("Un attimo, riprova");
    else toast.error(typeof json?.message === "string" && json.message.trim() ? json.message : FRASE_INVIO);
    return "errore" as const;
  } catch {
    toast.error(FRASE_INVIO);
    return "errore" as const;
  }
}

export function useInvitoMeet(
  chat: ChatPerInvito,
  ora: string,
  consulente: string | null,
  modo: ModoInvito = "meetly",
) {
  const [registro, setRegistro] = useState<RegistroInviti>({});
  const [inviando, setInviando] = useState(false);
  //  Il server ha detto «oltre le 24 ore» pur sapendo noi la finestra aperta: da qui si passa a WhatsApp.
  const [forzaWa, setForzaWa] = useState(false);
  const inCorso = useRef(false);

  //  Il registro si legge dopo il primo disegno: sul server non c'è localStorage.
  //  Le voci di altri giorni si buttano subito (anche dal dispositivo): niente numeri vecchi in giro.
  useEffect(() => {
    try {
      const oggi = oggiIso();
      const tutte = leggiRegistro(window.localStorage.getItem(CHIAVE_INVITI));
      const diOggi = Object.fromEntries(Object.entries(tutte).filter(([, v]) => v.giorno === oggi));
      setRegistro(diOggi);
      if (Object.keys(diOggi).length !== Object.keys(tutte).length)
        window.localStorage.setItem(CHIAVE_INVITI, JSON.stringify(diOggi));
    } catch {
      /* senza localStorage resta vuoto: il tasto funziona lo stesso */
    }
  }, []);

  //  Un altro meet nella barra: il «passa a WhatsApp» del cliente di prima non vale per lui.
  useEffect(() => {
    setForzaWa(false);
  }, [chat.phone]);

  const segna = useCallback(
    (via: VoceInvito["via"]) => {
      const adesso = new Date();
      setRegistro((prima) => {
        const dopo = registraInvito(prima, chat.phone, oggiIso(adesso), oraLocale(adesso.toISOString()), via);
        try {
          window.localStorage.setItem(CHIAVE_INVITI, JSON.stringify(dopo));
        } catch {
          /* idem */
        }
        return dopo;
      });
    },
    [chat.phone],
  );

  const preparato = preparaInvito(chat, ora, consulente, modo);
  const strada = forzaWa ? "whatsapp" : stradaInvito(chat);
  const fatto = preparato.ok
    ? invitoDiOggi(chat, registro, oggiIso(), preparato.invito.segno, oraLocale, giornoLocale)
    : null;

  const href = preparato.ok
    ? linkApriWhatsapp(chat.phone, typeof navigator === "undefined" ? "" : navigator.userAgent, preparato.invito.testo)
    : "";

  /** Chiede conferma se l'invito di oggi c'è già. `false` = l'utente ha lasciato perdere. */
  const confermaRinvio = () =>
    !fatto ||
    confirm(`L'invito è già stato ${fatto.via === "crm" ? "mandato" : "aperto in WhatsApp"} alle ${fatto.alle}. Rimandarlo?`);

  const invia = async () => {
    if (!preparato.ok || inCorso.current || strada !== "crm") return;
    if (!confermaRinvio()) return;
    inCorso.current = true;
    setInviando(true);
    try {
      const esito = await mandaDalCrm(chat.phone, chat.leadId ?? chat.lead?.id ?? null, preparato.invito.testo);
      if (esito === "ok") {
        segna("crm");
        if (preparato.invito.senzaLink) toast.success("Invito inviato", { description: PROMEMORIA_LINK });
        else toast.success("Invito inviato");
      } else if (esito === "fuori_finestra") {
        setForzaWa(true);
        toast.error("Finestra di 24 ore chiusa: scrivi da WhatsApp");
      }
    } finally {
      inCorso.current = false;
      setInviando(false);
    }
  };

  /** Click sul link wa.me: segna l'apertura (non si può sapere se poi premi invio sul telefono). */
  const alApriWhatsapp = (e: { preventDefault: () => void }) => {
    if (!confermaRinvio()) return e.preventDefault();
    segna("whatsapp");
    toast.message("WhatsApp aperto col testo pronto: premi invio");
  };

  return { preparato, strada, fatto, href, inviando, invia, alApriWhatsapp };
}
