/** ── LA REGIA, DAL LATO DELLE PAGINE ───────────────────────────────────────
 *
 *  Le regole stanno in shop/preventivi-di-gruppo (pure, provate); la riga sul
 *  server sta in api.public.regia-gruppo. Qui c'è il pezzo che serve a una
 *  pagina: leggerla ogni tanto, e cambiarla.
 *
 *  ⚠️ SI LEGGE A GIRO, non una volta sola: il consulente accende il preventivo
 *   comune mentre il cliente ha già la pagina aperta, e quella pagina deve
 *   accorgersene senza che nessuno la ricarichi. Tre secondi è il ritmo di una
 *   cosa che si fa a voce («ora te lo faccio vedere»), non di un cronometro.
 *  ⚠️ E NON SI LEGGE DA FERMI: fuori da una consulenza di gruppo questa riga
 *   non esiste, e chiederla ogni tre secondi per tutta la giornata sarebbe una
 *   richiesta al server per ogni pagina aperta di questo programma.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from "react";
import { leggiRegia, type Penna, type RegiaGruppo } from "@/shop/preventivi-di-gruppo";
import { ascoltaStatoStanza, statoStanzaOra } from "@/shop/stato-stanza";
import { annunciaRegiaCambiata } from "@/shop/annuncio-regia";

/*  ⚠️ CINQUE SECONDI, NON TRE: questo giro ormai lo fa solo il CONSULENTE (il
    cliente la riceve insieme alla pagina, vedi shop/stato-stanza), e le sue
    mosse sul pannello si vedono subito perché sono applicate di slancio, senza
    aspettare la riga. Tre secondi erano 1.200 richieste l'ora per niente. */
export const REGIA_OGNI_MS = 5000;

/** Cambia la regia. Torna la riga aggiornata, o `null` se non si è potuto
 *  (non autorizzato, rete): chi chiama lascia le cose come stanno. */
export async function cambiaRegia(
  code: string | null | undefined,
  patch: {
    comune?: boolean;
    aperto?: string;
    penna?: { chi: string; a: Penna };
    individuale?: { chi: string; acceso: boolean };
    /** Avvio di una consulenza: nessuno vede più il proprio preventivo. */
    azzera?: boolean;
  },
): Promise<RegiaGruppo | null> {
  const sess = String(code || "").trim();
  if (!sess) return null;
  try {
    const r = await fetch("/api/public/regia-gruppo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sess, ...patch }),
    });
    const j = (await r.json()) as { ok?: boolean; regia?: unknown };
    //  ⚠️ E lo si DICE a chi è nella stanza: senza, il cliente se ne
    //   accorgerebbe solo al prossimo giro — e i giri, da oggi, sono lenti
    //   apposta (vedi shop/stato-stanza).
    if (j?.ok) annunciaRegiaCambiata();
    return j?.ok && j.regia ? leggiRegia(JSON.stringify(j.regia)) : null;
  } catch {
    return null;
  }
}

/** La regia di questa consulenza, riletta a giro. `null` finché non si sa
 *  niente: chi legge non deve confondere «non ancora letta» con «tutto
 *  spento», o farebbe sparire il preventivo comune per un istante a ogni
 *  caricamento di pagina. */
export function useRegiaGruppo(
  code: string | null | undefined,
  attiva = true,
): { regia: RegiaGruppo | null; gruppo: boolean } {
  const [regia, setRegia] = useState<RegiaGruppo | null>(null);
  const [gruppo, setGruppo] = useState(false);
  //  Si riscrive solo quando cambia davvero: questa riga arriva ogni tre
  //  secondi, e uno `setState` a ogni giro rifarebbe i conti dell'intera
  //  pagina del preventivo per nulla.
  const ultimo = useRef("");
  useEffect(() => {
    const sess = String(code || "").trim();
    if (!attiva || !sess) return;
    let vivo = true;
    const giro = async () => {
      try {
        const r = await fetch(`/api/public/regia-gruppo?sess=${encodeURIComponent(sess)}`, { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; regia?: unknown; gruppo?: boolean };
        if (!vivo || !j?.ok) return;
        setGruppo(j.gruppo === true);
        const grezzo = JSON.stringify(j.regia ?? null);
        if (grezzo === ultimo.current) return;
        ultimo.current = grezzo;
        setRegia(leggiRegia(grezzo));
      } catch {
        /* rete: si riprova al giro dopo */
      }
    };
    /*  ── ⚠️ SE QUALCUNO LA STA GIÀ CHIEDENDO, NON SI CHIEDE DUE VOLTE ──────
        Dal lato del CLIENTE questa riga arriva già insieme alla pagina, in
        una risposta sola (shop/stato-stanza): chiederla di nuovo da qui
        voleva dire raddoppiare le richieste di ogni scheda cliente — ed è una
        delle tre voci che il 27/09/2026 hanno portato il sito a sbattere
        contro il tetto giornaliero del piano («Error 1027»).
        Dal lato del CONSULENTE nessuno la chiede, e allora la si chiede qui. */
    let sentito = 0;
    const smetti = ascoltaStatoStanza((st) => {
      if (!vivo || st.code !== sess) return;
      sentito = Date.now();
      setGruppo(st.gruppo === true);
      const grezzo = JSON.stringify(st.regia ?? null);
      if (grezzo === ultimo.current) return;
      ultimo.current = grezzo;
      setRegia(st.regia);
    });
    const giaServito = () => Date.now() - sentito < 12_000;
    const ora = statoStanzaOra(sess);
    if (ora) { sentito = Date.now(); setGruppo(ora.gruppo === true); setRegia(ora.regia); ultimo.current = JSON.stringify(ora.regia ?? null); }
    if (!giaServito()) void giro();
    const iv = setInterval(() => { if (!giaServito()) void giro(); }, REGIA_OGNI_MS);
    return () => { vivo = false; smetti(); clearInterval(iv); };
  }, [code, attiva]);
  return { regia, gruppo };
}
