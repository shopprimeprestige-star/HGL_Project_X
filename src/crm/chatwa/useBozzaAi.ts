/** ── LA BOZZA AI GIÀ PRONTA SU «DA RISPONDERE» (30/10/2026) ──────────────────
 *
 *  Quando una chat aspetta risposta, il Mac può aver già preparato una bozza
 *  (riga di `wa_risposte_ai` con `automatica = true` e stato «pronta», vedi
 *  crm/risposte-ai/ingresso `preparaBozza`). Qui la si legge per la chat aperta
 *  e si decide se mostrarla (`bozzaDaMostrare`, pura e provata).
 *  ⚠️ NON SI INVIA MAI DA SOLA e non sovrascrive niente: «Usa» passa il testo a
 *   chi chiama, che lo aggiunge sotto quello già scritto.
 *  ⚠️ Senza la migrazione 20261030100000 la colonna `automatica` manca: la
 *   lettura si ferma in silenzio e la chat va come prima, senza bozze.
 *  shortcut: le bozze usate o scartate si ricordano su questo dispositivo
 *   (localStorage), non nel database; su un altro telefono la bozza compare
 *   ancora finché non si usa o scarta anche lì. Da cambiare con una colonna
 *   `scartata_il` se serve a più persone.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bozzaDaMostrare, colonnaMancante, type BozzaRiga } from "@/crm/risposte-ai/regole";
import type { WaMessageRow } from "./tipi";

type Esito = { data: BozzaRiga[] | null; error: { code?: string } | null };
type Q = {
  select: (c: string) => Q;
  eq: (c: string, v: string | boolean) => Q;
  in: (c: string, v: string[]) => Q;
  order: (c: string, o: { ascending: boolean }) => Q;
  limit: (n: number) => PromiseLike<Esito>;
};
const tabella = (t: string) => (supabase as unknown as { from: (t: string) => Q }).from(t);

const CHIAVE_SCARTATE = "hgl-bozze-ai-scartate";
const MAX_RICORDATE = 50;
/** Ogni quanto si rilegge, finché la chat aspetta e la bozza non c'è. */
const OGNI_MS = 15_000;

const leggiScartate = (): string[] => {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(CHIAVE_SCARTATE) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export interface BozzaAiApi {
  bozza: BozzaRiga | null;
  /** nasconde la bozza per sempre (usata o scartata) */
  scarta: () => void;
}

export function useBozzaAi(p: {
  telefono: string | null;
  /** la chat aspetta una risposta */
  inAttesa: boolean;
  messaggi: WaMessageRow[];
}): BozzaAiApi {
  const [righe, setRighe] = useState<BozzaRiga[]>([]);
  const [scartate, setScartate] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : leggiScartate(),
  );
  const ultimoId = p.messaggi.at(-1)?.id ?? "";

  useEffect(() => {
    setRighe([]);
    if (!p.telefono || !p.inAttesa) return;
    let vivo = true;
    const d = p.telefono.replace(/\D/g, "");
    const leggi = async () => {
      try {
        const { data, error } = await tabella("wa_risposte_ai")
          .select("id, risposta, creata_il")
          .eq("automatica", true)
          .eq("stato", "pronta")
          .in("telefono", [`+${d}`, d])
          .order("creata_il", { ascending: false })
          .limit(3);
        if (!vivo) return;
        if (error) {
          //  Colonna o tabella mancanti: niente bozze, e non si insiste.
          if (colonnaMancante(error) || ["42P01", "PGRST205"].includes(String(error.code)))
            clearInterval(t);
          return;
        }
        setRighe(data ?? []);
      } catch {
        /* senza rete si riprova al giro dopo */
      }
    };
    const t = setInterval(() => void leggi(), OGNI_MS);
    void leggi();
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [p.telefono, p.inAttesa, ultimoId]);

  const bozza = p.inAttesa ? bozzaDaMostrare(righe, p.messaggi, scartate) : null;

  const id = bozza?.id;
  const scarta = useCallback(() => {
    if (!id) return;
    setScartate((prima) => {
      const dopo = [...prima, id].slice(-MAX_RICORDATE);
      try {
        window.localStorage.setItem(CHIAVE_SCARTATE, JSON.stringify(dopo));
      } catch {
        /* senza memoria locale vale solo finché la pagina è aperta */
      }
      return dopo;
    });
  }, [id]);

  return { bozza, scarta };
}
