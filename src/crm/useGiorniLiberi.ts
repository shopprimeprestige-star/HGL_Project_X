/** ── I GIORNI LIBERI DELLA SQUADRA, IN UN AGGANCIO SOLO ─────────────────────
 *
 *  Commessa 2026-10-14 (la setter e i posti liberi). Il calcolo stava dentro
 *  la pagina Slot liberi e non si poteva riusare: adesso lo usano la pagina,
 *  la striscia dei posti in «Oggi» e in Lead importati. Stesso aggancio, stessa
 *  squadra, stessa durata, stesse ore tenute, stessa regola su oggi: stesso
 *  giorno = stesso numero, per costruzione.
 *
 *  ⚠️ SPOSTATO, NON RISCRITTO. Il codice è quello della pagina, riga per riga
 *   (le ore tenute, l'orologio a 60 s, la squadra, il ciclo con
 *   `slotDelGiorno` e `riassumiGiorno`). I numeri della pagina prima e dopo lo
 *   spostamento sono annotati in prove/prove.mjs (proveDeiNumeriDiSlotLiberi).
 *  ⚠️ LE ORE TENUTE PER UNA PERSONA SOLA si leggono dal server in una
 *   richiesta sola (api.crm.fascia-modo?tutte=1), che chiede il permesso
 *   `agenda`: senza, un'ora «solo» con il suo cliente dentro risulterebbe
 *   «1 di 3, c'è posto». Per questo la striscia si mostra solo a chi ha
 *   `agenda` (vedi crm/vista-oggi).
 *  ⚠️ TUTTI GLI HOOK IN CIMA, NESSUNA USCITA ANTICIPATA (React #310, è già
 *   successo in produzione). La prova degli hook copre questo file.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import { useCRM } from "@/crm/CRMContext";
import { intestazioniCRM } from "@/crm/AuthContext";
import { assicuraBlocchi } from "@/crm/blocchi";
import { assicuraCapienza } from "@/crm/capienza";
import { slotDelGiorno } from "@/crm/booking-utils";
import { consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import { DURATA_PREDEFINITA } from "@/crm/invito";
import type { ModoFascia } from "@/crm/fascia-consulenza";
import { riassumiGiorno, type GiornoLibero } from "@/crm/slot-liberi";
import type { Consultant } from "@/crm/types";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Le ore tenute per una persona sola, «AAAA-MM-GG HH:MM» in ora locale. */
export function useOreTenute(): Record<string, "solo"> {
  const [ore, setOre] = useState<Record<string, "solo">>({});
  useEffect(() => {
    let vivo = true;
    void intestazioniCRM()
      .then((headers) => fetch("/api/crm/fascia-modo?tutte=1", { headers }))
      .then((r: Response) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; solo?: Record<string, string[]> } | null) => {
        if (!vivo || !j?.ok || !j.solo) return;
        const fuori: Record<string, "solo"> = {};
        for (const quandi of Object.values(j.solo)) {
          for (const q of quandi) {
            //  Le chiavi arrivano in UTC: qui diventano locali, come le ore disegnate.
            const d = new Date(`${q}Z`);
            if (Number.isNaN(d.getTime())) continue;
            const ora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            fuori[`${iso(d)} ${ora}`] = "solo";
          }
        }
        setOre(fuori);
      })
      .catch(() => {
        /* senza, si conta come se nessuna ora fosse tenuta */
      });
    return () => {
      vivo = false;
    };
  }, []);
  return ore;
}

/** I giorni della squadra da oggi in avanti, `quanti` giorni di calendario
 *  (oggi senza le ore già passate). `chi`: "tutti" oppure l'id di un
 *  consulente. `squadra` = chi fa consulenze, attivo, con una settimana. */
export function useGiorniLiberi(o: { quanti: number; chi?: string }): {
  squadra: Consultant[];
  giorni: GiornoLibero[];
  /** Vero quando chiusure e capienza sono state lette: prima i posti
   *  potrebbero essere più di quelli veri. */
  pronto: boolean;
} {
  const periodo = o.quanti;
  const chi = o.chi ?? "tutti";
  const { leads, consultants } = useCRM();
  const oreTenute = useOreTenute();
  //  L'ora corrente, rinfrescata ogni minuto: le ore di oggi già passate escono.
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAdesso(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const squadra = useMemo(() => {
    const { elenco } = consulentiPerConsulenza(Array.isArray(consultants) ? consultants : []);
    return elenco.filter(
      (c) => c?.data && c.data.attivo !== false && Array.isArray(c.data.giorniLavorativi),
    );
  }, [consultants]);

  /*  ⚠️ LE CHIUSURE E LA CAPIENZA PRIMA DEL CALCOLO (28/10/2026). `slotDelGiorno`
      le legge da un registro che si riempie solo se qualcuno le ha caricate:
      la pagina Orari disponibili lo faceva, Slot liberi e «Proponi orari» in
      WhatsApp no — e mostravano libere ore chiuse. Segnalazione del titolare:
      «deve mostrare le vere disponibilità». Arrivate, si ricalcola. */
  const [caricati, setCaricati] = useState(0);
  useEffect(() => {
    let vivo = true;
    void Promise.all([assicuraBlocchi(), assicuraCapienza()])
      .catch(() => undefined)
      .then(() => vivo && setCaricati((n) => n + 1));
    return () => {
      vivo = false;
    };
  }, []);

  const scelti = useMemo(
    () => (chi === "tutti" ? squadra : squadra.filter((c) => c.id === chi)),
    [squadra, chi],
  );

  const giorni = useMemo<GiornoLibero[]>(() => {
    const elenco = Array.isArray(leads) ? leads.filter((l) => l && l.data) : [];
    const oggi = new Date(adesso);
    oggi.setHours(0, 0, 0, 0);
    const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();
    const out: GiornoLibero[] = [];
    for (let i = 0; i < periodo; i++) {
      const d = new Date(oggi);
      d.setDate(oggi.getDate() + i);
      const data = iso(d);
      const modi = new Map<string, ModoFascia>();
      for (const [k, v] of Object.entries(oreTenute)) {
        const [g, ora] = k.split(" ");
        if (g === data && ora) modi.set(ora, v);
      }
      const persone = scelti.map((c) => {
        let slot: ReturnType<typeof slotDelGiorno> = [];
        try {
          slot = slotDelGiorno(c, data, DURATA_PREDEFINITA, elenco, undefined, undefined, modi);
        } catch {
          /* un consulente con orari illeggibili non ferma la pagina */
        }
        return { id: c.id, nome: c.data.nome || "Senza nome", slot };
      });
      out.push(riassumiGiorno({ data, persone, dopo: i === 0 ? minutiAdesso : undefined }));
    }
    return out;
  }, [leads, scelti, periodo, oreTenute, adesso, caricati]);

  return { squadra, giorni, pronto: caricati > 0 };
}
