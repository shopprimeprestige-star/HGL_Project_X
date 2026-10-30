/** ── INVIO DAL TELEFONO (PONTE) · I DATI DELLA CHAT ─────────────────────────
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compito T6 (PIANO §4.3). Legge la
 *  coda `ponte_wa_invii` dell'utente (le righe delle ultime 24 ore), ne ricava
 *  per la chat aperta: se il tasto «Scrivi dal telefono» si può mostrare
 *  (`puo`), le bolle in coda (`coda`), i messaggi ancora possibili oggi
 *  (`restanti`), e mette in coda o riprova un messaggio (`invia`, `riprova`).
 *
 *  ⚠️ È L'UNICO CHIAMANTE di `/api/crm/ponte-invio`. Il giro automatico, i
 *   promemoria, «Da rispondere» e i non letti non lo nominano mai (SPEC 6).
 *  ⚠️ Legge soltanto: scrivere passa dal server, che ricontrolla tutto.
 *  ⚠️ Rilegge subito, dopo ogni invio, a ogni nuova lettura della chat (così la
 *   bolla «in invio» lascia il posto alla riga vera il prima possibile), ogni 3
 *   secondi finché c'è qualcosa in volo, ogni 30 altrimenti; a scheda nascosta
 *   niente. Nessun tempo reale.
 *  ⚠️ Errore, rete assente o tabella non ancora creata (migrazione non
 *   applicata): nessuna coda e nessun tasto; la pagina non mostra mai un errore
 *   per colpa di questa lettura.
 *  ⚠️ Nessun log: né testo dei messaggi né numeri. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchCRM } from "@/crm/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LIMITI_INVIO, type ApiPonteInvio, type RigaCoda } from "../ponte/invio-tipi";
import {
  bolleDellaChat,
  chiaveDelTentativo,
  esitoRichiesta,
  numeroDellaChat,
  prossimaLettura,
  puoScrivere,
  restantiOggi,
  type Tentativo,
} from "./invioPonte";
import type { ChatItem, WaMessageRow } from "./tipi";
import { useRigaPonte } from "./usaStatoPonte";

/** Le colonne di `RigaCoda`. Mai «*»: il testo dei clienti non si legge più del dovuto. */
const COLONNE = "id,chiave,numero,testo,stato,motivo,created_at,preso_il,inviato_il,wa_message_id";
/** Tetto di righe lette: 20 al giorno più qualche non inviato. */
const MASSIMO_RIGHE = 200;

/** La catena di Supabase, ridotta ai soli metodi usati qui. I tipi generati non
 *  conoscono la tabella nuova: da qui il cast, come in `usaStatoPonte`. */
interface Catena extends PromiseLike<{ data: RigaCoda[] | null; error: unknown }> {
  select: (s: string) => Catena;
  eq: (k: string, v: string) => Catena;
  gte: (k: string, v: string) => Catena;
  order: (k: string, o: { ascending: boolean }) => Catena;
  limit: (n: number) => Catena;
}

export function useInvioPonte(i: {
  userId: string | undefined;
  attiva: ChatItem | null;
  /** i messaggi VERI della chat aperta (la coda non ne fa parte) */
  messaggi: WaMessageRow[];
  /** ora (ms) aggiornata dalla chat ogni 30 s */
  adesso: number;
  /** cresce a ogni lettura della chat: è il segnale «è arrivato qualcosa» */
  letture: number;
}): ApiPonteInvio {
  const { userId, attiva, messaggi, adesso, letture } = i;
  const ponte = useRigaPonte();
  const [righe, setRighe] = useState<RigaCoda[]>([]);
  const [leggibile, setLeggibile] = useState(false);
  /** Ora dell'ultima lettura: tiene viva la vista (un inviato si nasconde dopo 90 s). */
  const [lettaIl, setLettaIl] = useState(() => Date.now());
  const [inviando, setInviando] = useState(false);
  const inviandoRef = useRef(false);
  const tentativoRef = useRef<Tentativo | null>(null);
  const righeRef = useRef<RigaCoda[]>([]);
  /** Rilegge adesso (lo usano l'effetto, `invia` e `riprova`). */
  const leggiRef = useRef<() => Promise<void>>(async () => undefined);

  // ── La lettura ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      righeRef.current = [];
      setRighe([]);
      setLeggibile(false);
      leggiRef.current = async () => undefined;
      return;
    }
    let vivo = true;
    let inCorso = false;
    /** Una lettura chiesta mentre un'altra era in corso: si rifà appena finisce. */
    let ancora = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    //  La prossima lettura fra 3 o 30 secondi, secondo cosa c'è in volo: si
    //  rifà dopo OGNI lettura, anche quella chiesta da fuori (un invio appena fatto).
    const pianifica = () => {
      if (timer) clearTimeout(timer);
      if (!vivo) return;
      timer = setTimeout(() => void leggi(), prossimaLettura(righeRef.current, new Date()));
    };

    const leggi = async (): Promise<void> => {
      if (inCorso) {
        ancora = true;
        return;
      }
      if (document.visibilityState === "hidden") {
        pianifica();
        return;
      }
      inCorso = true;
      let nuove: RigaCoda[] | null = null;
      try {
        const da = new Date(Date.now() - LIMITI_INVIO.giornoOre * 3_600_000).toISOString();
        const { data, error } = await (supabase as unknown as { from: (t: string) => Catena })
          .from("ponte_wa_invii")
          .select(COLONNE)
          .eq("user_id", userId)
          .gte("created_at", da)
          //  dal più nuovo: oltre il tetto cadono le più vecchie, non le ultime
          .order("created_at", { ascending: false })
          .limit(MASSIMO_RIGHE);
        if (!error && Array.isArray(data)) nuove = data;
      } catch {
        //  rete o permessi: nessuna coda
      }
      inCorso = false;
      if (!vivo) return;
      //  Con un errore la coda si toglie: una coda vecchia sarebbe una bugia.
      righeRef.current = nuove ?? [];
      setRighe(righeRef.current);
      setLeggibile(nuove !== null);
      setLettaIl(Date.now());
      pianifica();
      if (ancora) {
        ancora = false;
        void leggi();
      }
    };
    leggiRef.current = leggi;

    void leggi();
    const ritorno = () => {
      if (document.visibilityState !== "hidden") void leggi();
    };
    document.addEventListener("visibilitychange", ritorno);
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", ritorno);
    };
  }, [userId]);

  //  Una nuova lettura della chat (un messaggio arrivato): rilegge anche la coda.
  useEffect(() => {
    if (letture > 0) void leggiRef.current();
  }, [letture]);

  // ── Cosa mostrare ───────────────────────────────────────────────────────
  const numero = numeroDellaChat(attiva?.phone);
  const ora = useMemo(() => new Date(Math.max(adesso, lettaIl)), [adesso, lettaIl]);

  const puo = useMemo(
    () =>
      puoScrivere({
        leggibile,
        numero,
        ponte,
        messaggi,
        contatto: attiva?.contact ?? null,
        stop: attiva?.stop ?? false,
        righe,
        adesso: ora,
      }),
    [leggibile, numero, ponte, messaggi, attiva?.contact, attiva?.stop, righe, ora],
  );
  const coda = useMemo(
    () => bolleDellaChat(righe, numero, messaggi, ora),
    [righe, numero, messaggi, ora],
  );
  const restanti = leggibile ? restantiOggi(righe, ora) : null;

  // ── Le due azioni ───────────────────────────────────────────────────────
  /** Una richiesta alla rotta: `true` se il messaggio è in coda; altrimenti la
   *  frase del rifiuto è già a schermo. */
  const chiama = useCallback(async (corpo: Record<string, unknown>): Promise<boolean> => {
    if (inviandoRef.current) return false;
    inviandoRef.current = true;
    setInviando(true);
    try {
      const res = await fetchCRM("/api/crm/ponte-invio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json: unknown = await res.json().catch(() => null);
      const esito = esitoRichiesta(res.status, json);
      if (!esito.ok) {
        toast.error(esito.frase);
        return false;
      }
      return true;
    } catch {
      toast.error("Invio non riuscito, riprova");
      return false;
    } finally {
      inviandoRef.current = false;
      setInviando(false);
    }
  }, []);

  const invia = useCallback(
    async (testo: string): Promise<boolean> => {
      if (!numero || testo.trim() === "") return false;
      //  Lo stesso tocco ripetuto (stesso cliente, stesso testo) porta la stessa
      //  chiave: la rotta non mette due messaggi in coda. Cambia solo a invio riuscito.
      const t = chiaveDelTentativo(tentativoRef.current, numero, testo);
      tentativoRef.current = t;
      const fatto = await chiama({ azione: "accoda", numero, testo, chiave: t.chiave });
      if (fatto) tentativoRef.current = null;
      //  Subito la bolla «in invio», o lo stato aggiornato dopo un rifiuto.
      void leggiRef.current();
      return fatto;
    },
    [numero, chiama],
  );

  const riprova = useCallback(
    async (id: string, confermaIncerto?: boolean): Promise<boolean> => {
      const fatto = await chiama(
        confermaIncerto
          ? { azione: "riprova", id, confermaIncerto: true }
          : { azione: "riprova", id },
      );
      void leggiRef.current();
      return fatto;
    },
    [chiama],
  );

  return { puo, coda, restanti, inviando, invia, riprova };
}
