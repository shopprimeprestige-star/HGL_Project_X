/** ── L'ELENCO UNICO DEGLI AVVISI ───────────────────────────────────────────
 *
 *  IL PROBLEMA
 *  Gli avvisi arrivano da due parti: il motore nel browser (appuntamenti,
 *  installazioni, incassi — memoria locale) e il controllo campagne (spesa,
 *  lead, creative — tabella `notifications`). La campanella leggeva SOLO la
 *  tabella: tutto quello che il motore produceva restava invisibile, e il
 *  numero rosso non contava mai gli avvisi operativi, cioè quelli che servono
 *  davvero durante la giornata.
 *
 *  QUI I DUE ELENCHI DIVENTANO UNO
 *  Le due fonti si uniscono sulla chiave dell'evento (`chiave` in locale,
 *  `dedupe_key` a database, che il motore scrive uguali): lo stesso avviso
 *  salvato in entrambi i posti resta UNA riga sola. Quando la riga esiste di
 *  qua e di là si tiene il meglio dei due: lo stato "letta" dal database
 *  (vale su tutti i dispositivi) e la trattativa collegata dal locale (è ciò
 *  che permette al clic di aprire la scheda giusta invece della pagina).
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { CATALOGO, etichettaTipo, type TipoEvento } from "./catalogo";
import {
  EVENTO_STORICO,
  leggiStorico,
  nonLetta,
  segnaLetteStorico,
  segnaTutteLetteStorico,
  type VoceStorico,
} from "./registro";
import type { NotificationRow, NotificationSeverity } from "./types";

export interface Avviso {
  /** Identità della riga a schermo: la chiave dell'evento quando c'è, così la
   *  stessa notifica non cambia identità passando da locale a database. */
  id: string;
  idLocale?: string;
  idDatabase?: string;
  tipo: string;
  etichetta: string;
  titolo: string;
  corpo: string;
  gravita: NotificationSeverity;
  /** ISO. */
  quando: string;
  /** Presente solo per gli avvisi che riguardano UNA trattativa. */
  leadId?: string;
  destinazione?: string;
  letta: boolean;
  quantita: number;
}

function gravitaDi(v: VoceStorico): NotificationSeverity {
  if (v.gravita === "critical" || v.gravita === "warning" || v.gravita === "info") return v.gravita;
  return CATALOGO[v.tipo as TipoEvento]?.gravita ?? "info";
}

function gravitaRiga(r: NotificationRow): NotificationSeverity {
  return r.severity === "critical" || r.severity === "warning" ? r.severity : "info";
}

function daLocale(v: VoceStorico): Avviso {
  return {
    id: v.chiave || v.id,
    idLocale: v.id,
    tipo: v.tipo,
    etichetta: etichettaTipo(v.tipo),
    titolo: v.titolo,
    corpo: v.corpo,
    gravita: gravitaDi(v),
    quando: v.inviataIl,
    leadId: v.leadId,
    destinazione: v.destinazione,
    letta: !nonLetta(v),
    quantita: v.quantita || 1,
  };
}

function daDatabase(r: NotificationRow): Avviso {
  return {
    id: r.dedupe_key || r.id,
    idDatabase: r.id,
    tipo: r.kind,
    etichetta: etichettaTipo(r.kind),
    titolo: r.title,
    corpo: r.body || "",
    gravita: gravitaRiga(r),
    quando: r.created_at,
    destinazione: r.link || undefined,
    letta: !!r.read_at,
    quantita: 1,
  };
}

/** Le due righe della stessa notifica diventano una: il collegamento alla
 *  scheda viene dal locale, lo stato "letta" da chi delle due l'ha già vista. */
function fondi(a: Avviso, b: Avviso): Avviso {
  return {
    ...a,
    ...b,
    idLocale: a.idLocale ?? b.idLocale,
    idDatabase: a.idDatabase ?? b.idDatabase,
    leadId: a.leadId ?? b.leadId,
    destinazione: a.destinazione ?? b.destinazione,
    corpo: a.corpo || b.corpo,
    quantita: Math.max(a.quantita, b.quantita),
    letta: a.letta || b.letta,
    // Fra i due orari vince il più vecchio: è il momento in cui l'avviso è
    // nato, non quello in cui la copia è stata scritta.
    quando: a.quando < b.quando ? a.quando : b.quando,
  };
}

/** Quante volte al minuto ha senso rileggere il database: gli avvisi operativi
 *  arrivano già in tempo reale dal motore, questo serve solo agli alert
 *  campagne e alle altre postazioni. */
const RILETTURA_MS = 60_000;

export function useAvvisi() {
  const { user } = useAuth();
  const [righeDb, setRigheDb] = useState<NotificationRow[]>([]);
  const [locali, setLocali] = useState<VoceStorico[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  /** Ogni istanza del hook ha il suo canale: due canali con lo stesso nome
   *  (campanella + pagina Notifiche aperte insieme) si disturbano. */
  const canaleRef = useRef(`notif-${Math.random().toString(36).slice(2, 8)}`);

  const leggiDb = useCallback(async () => {
    if (!user) {
      setCaricamento(false);
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setRigheDb((data as NotificationRow[]) || []);
    setCaricamento(false);
  }, [user]);

  useEffect(() => {
    void leggiDb();
    const id = setInterval(() => void leggiDb(), RILETTURA_MS);
    return () => clearInterval(id);
  }, [leggiDb]);

  // Lo storico locale si rilegge quando il motore ne scrive uno nuovo: senza
  // questo, la campanella mostrerebbe la situazione di quando è stata montata.
  useEffect(() => {
    const aggiorna = () => setLocali(leggiStorico());
    aggiorna();
    window.addEventListener(EVENTO_STORICO, aggiorna);
    window.addEventListener("storage", aggiorna);
    return () => {
      window.removeEventListener(EVENTO_STORICO, aggiorna);
      window.removeEventListener("storage", aggiorna);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const canale = supabase
      .channel(`${canaleRef.current}:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void leggiDb(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canale);
    };
  }, [user, leggiDb]);

  const avvisi = useMemo(() => {
    const per = new Map<string, Avviso>();
    for (const v of locali) {
      const a = daLocale(v);
      const gia = per.get(a.id);
      per.set(a.id, gia ? fondi(gia, a) : a);
    }
    for (const r of righeDb) {
      const a = daDatabase(r);
      const gia = per.get(a.id);
      per.set(a.id, gia ? fondi(gia, a) : a);
    }
    return [...per.values()].sort((x, y) => y.quando.localeCompare(x.quando));
  }, [locali, righeDb]);

  const nonLette = useMemo(() => avvisi.filter((a) => !a.letta).length, [avvisi]);

  const segnaLetta = useCallback(async (a: Avviso) => {
    if (a.idLocale) segnaLetteStorico([a.idLocale]);
    if (a.idDatabase) {
      const adesso = new Date().toISOString();
      setRigheDb((prima) =>
        prima.map((r) => (r.id === a.idDatabase ? { ...r, read_at: adesso } : r)),
      );
      await supabase.from("notifications").update({ read_at: adesso }).eq("id", a.idDatabase);
    }
  }, []);

  const segnaTutte = useCallback(async () => {
    segnaTutteLetteStorico();
    if (!user) return;
    const adesso = new Date().toISOString();
    setRigheDb((prima) => prima.map((r) => (r.read_at ? r : { ...r, read_at: adesso })));
    await supabase
      .from("notifications")
      .update({ read_at: adesso })
      .eq("user_id", user.id)
      .is("read_at", null);
  }, [user]);

  return { avvisi, nonLette, caricamento, segnaLetta, segnaTutte, ricarica: leggiDb };
}
