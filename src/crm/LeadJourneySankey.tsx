/** ─────────────────────────────────────────────────────────────────────────
 *  LeadJourneySankey — il percorso di UNA persona fra gli annunci
 *
 *  PERCHÉ NON C'È PIÙ UN SANKEY (il nome del file resta: lo importa la scheda
 *  del lead, e rinominarlo tocca un file che non è mio)
 *  Il diagramma serve a far vedere QUANTE persone passano da un ramo all'altro:
 *  qui la persona è una sola, quindi ogni nastro valeva 1 e la larghezza — cioè
 *  l'unica cosa che un Sankey sa dire — non diceva niente. In cambio costava
 *  260px di margini per le etichette dentro un pannello laterale largo 500:
 *  restavano circa due centimetri di grafico e i nomi degli annunci tagliati.
 *
 *  Al suo posto c'è la stessa sequenza come elenco numerato, in ordine di
 *  tempo, con il ruolo di ogni tappa scritto nelle parole dell'attribuzione
 *  («Primo annuncio», «Annunci di mezzo», «Ultimo annuncio»): le stesse che si
 *  leggono in /CRM/attribuzione, così chi apre le due pagine non deve imparare
 *  due vocabolari.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo } from "react";
import { PAROLE, type RuoloAnnuncio } from "@/crm/attribution/parole";
import { dataBreve } from "@/crm/ui";

interface Touchpoint {
  ts: string;
  adId: string | null;
  adName: string | null;
}
interface Props {
  touchpoints: Touchpoint[];
  firstClickAdId: string | null;
  lastClickAdId: string | null;
}

interface Tappa {
  adId: string;
  nome: string;
  /** quando quell'annuncio è stato visto la prima volta */
  quando: string | null;
  ruolo: RuoloAnnuncio;
}

export function LeadJourneySankey({ touchpoints, firstClickAdId, lastClickAdId }: Props) {
  const tappe = useMemo<Tappa[]>(() => {
    //  Un annuncio visto tre volte è una tappa sola: quello che si sta
    //  raccontando è l'ordine in cui li ha incontrati, non quante volte.
    const visti = new Set<string>();
    const sequenza: { id: string; nome: string; quando: string | null }[] = [];
    for (const t of touchpoints) {
      if (!t.adId || visti.has(t.adId)) continue;
      visti.add(t.adId);
      sequenza.push({
        id: t.adId,
        nome: t.adName || `…${t.adId.slice(-8)}`,
        quando: t.ts || null,
      });
    }
    //  Primo e ultimo clic arrivano dall'attribuzione e possono mancare dai
    //  passaggi registrati: senza questo, il percorso comincerebbe o finirebbe
    //  su un annuncio diverso da quello a cui è attribuita la vendita.
    if (firstClickAdId && !visti.has(firstClickAdId)) {
      sequenza.unshift({ id: firstClickAdId, nome: `…${firstClickAdId.slice(-8)}`, quando: null });
    }
    if (lastClickAdId && !visti.has(lastClickAdId)) {
      sequenza.push({ id: lastClickAdId, nome: `…${lastClickAdId.slice(-8)}`, quando: null });
    }
    if (sequenza.length < 2) return [];
    return sequenza.map((s, i) => ({
      adId: s.id,
      nome: s.nome,
      quando: s.quando,
      ruolo: i === 0 ? "primo" : i === sequenza.length - 1 ? "ultimo" : "mezzo",
    }));
  }, [touchpoints, firstClickAdId, lastClickAdId]);

  if (tappe.length === 0) {
    return (
      <p className="rounded-md bg-secondary/40 p-3 text-[12px] text-muted-foreground">
        Un annuncio solo: non c'è un percorso da raccontare.
      </p>
    );
  }

  return (
    <ol className="space-y-1">
      {tappe.map((t, i) => (
        <li key={`${t.adId}-${i}`} className="flex items-start gap-2.5">
          {/*  La colonna di sinistra è il filo del tempo: pallino, numero e
               segmento verticale fino alla tappa dopo. Costa una riga di
               markup e sostituisce un grafico intero. */}
          <span className="flex w-4 shrink-0 flex-col items-center pt-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                t.ruolo === "ultimo" ? "bg-foreground" : "bg-muted-foreground/50"
              }`}
            />
            {i < tappe.length - 1 && <span className="mt-0.5 w-px flex-1 bg-border" />}
          </span>

          <span className="min-w-0 flex-1 pb-2">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={`min-w-0 max-w-full truncate text-[12.5px] ${
                  t.ruolo === "ultimo" ? "font-semibold" : "font-medium"
                }`}
                title={t.nome}
              >
                {t.nome}
              </span>
              {t.quando && (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {dataBreve(t.quando)}
                </span>
              )}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {PAROLE[t.ruolo].tappa}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
