/** ─────────────────────────────────────────────────────────────────────────
 *  AttributionSankeyChart — il diagramma a flusso dei percorsi
 *
 *  COSA DISEGNA
 *  Tre colonne: il primo annuncio visto, gli annunci di mezzo, l'ultimo prima
 *  del contatto. La larghezza di ogni nastro è il numero di persone.
 *
 *  COSA È CAMBIATO, E PERCHÉ
 *   · NON È PIÙ SOLO. Il diagramma non si legge sotto i ~900px: i margini per
 *     le etichette (280px in tutto) su un telefono lasciavano un centimetro di
 *     grafico. Adesso vive dentro <FlussoAnnunci/>, che lo mostra solo dove c'è
 *     spazio e affianca SEMPRE l'elenco degli stessi percorsi in parole e
 *     numeri. Un grafico che non si legge è decorazione, non informazione.
 *   · PARLA ITALIANO. «Direct» e «Altre ad» erano scritte qui dentro a mano;
 *     ora arrivano da parole.tsx, lo stesso posto da cui le prende la legenda.
 *   · IL COLORE È UN SEGNALE. Prima ogni nodo era dello stesso viola: bello e
 *     muto. Ora il colore distingue l'unica cosa che cambia la decisione — un
 *     annuncio vero (sky, ci si può fare qualcosa) da un raggruppamento
 *     (slate, non è un annuncio: non si può mettere in pausa «Altri annunci»).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo } from "react";
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from "recharts";
import type { AttributionJourneyRow, AttributionAdRanking } from "@/crm/ads-financials.functions";
import { ALTRI_ANNUNCI, NESSUN_ANNUNCIO, type RuoloVista } from "@/crm/attribution/parole";

export interface SankeyNodeClick {
  /**  Il diagramma emette solo primo/mezzo/ultimo; il tipo è più largo perché
   *   la stessa richiesta («fammi vedere chi ha visto questo annuncio») arriva
   *   anche dalla classifica, dove il momento del percorso non c'entra. */
  ruolo: RuoloVista;
  /** null quando il nodo è un raggruppamento («Altri annunci» / «Nessun annuncio») */
  adId: string | null;
  etichetta: string;
  raggruppato: boolean;
}

interface Props {
  journeys: AttributionJourneyRow[];
  adRanking: AttributionAdRanking[];
  topN?: number;
  onNodeClick?: (n: SankeyNodeClick) => void;
}

interface SankeyNode {
  name: string;
  nodeId?: string;
  column?: number;
  meta?: SankeyNodeClick;
}
interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

//  Le due tinte del CRM: sky = «ci puoi agire adesso», slate = «neutro, non è
//  una cosa su cui si decide». Nessun terzo colore: il diagramma non deve
//  aggiungere un vocabolario di colori tutto suo.
const COLORE_ANNUNCIO = "oklch(0.58 0.13 235)";
const COLORE_GRUPPO = "oklch(0.68 0.02 250)";

export function AttributionSankeyChart({ journeys, adRanking, topN = 10, onNodeClick }: Props) {
  const data = useMemo(() => {
    const top = [...adRanking].sort((a, b) => b.totalTouches - a.totalTouches).slice(0, topN);
    const topIds = new Set(top.map((a) => a.adId));
    const labelOf = (id: string): string => {
      const a = adRanking.find((x) => x.adId === id);
      return a?.adName ? a.adName.slice(0, 32) : `…${id.slice(-8)}`;
    };
    const resolve = (
      id: string | null,
    ): { name: string; adId: string | null; raggruppato: boolean } => {
      if (!id) return { name: NESSUN_ANNUNCIO, adId: null, raggruppato: true };
      if (topIds.has(id)) return { name: labelOf(id), adId: id, raggruppato: false };
      return { name: ALTRI_ANNUNCI, adId: null, raggruppato: true };
    };

    const nodes: SankeyNode[] = [];
    const idx = new Map<string, number>();
    const ensureNode = (
      key: string,
      name: string,
      column: number,
      meta: SankeyNodeClick,
    ): number => {
      const existing = idx.get(key);
      if (existing !== undefined) return existing;
      const i = nodes.length;
      nodes.push({ name, nodeId: key, column, meta });
      idx.set(key, i);
      return i;
    };

    const linkAgg = new Map<string, number>();
    const addLink = (s: number, t: number) => {
      const k = `${s}->${t}`;
      linkAgg.set(k, (linkAgg.get(k) || 0) + 1);
    };

    for (const j of journeys) {
      const f = resolve(j.firstClickAdId);
      const l = resolve(j.lastClickAdId);
      const firstNode = ensureNode(`F::${f.name}`, f.name, 0, {
        ruolo: "primo",
        adId: f.adId,
        etichetta: f.name,
        raggruppato: f.raggruppato,
      });
      const lastNode = ensureNode(`L::${l.name}`, l.name, 2, {
        ruolo: "ultimo",
        adId: l.adId,
        etichetta: l.name,
        raggruppato: l.raggruppato,
      });

      const midResolved = j.intermediateAdIds.map(resolve);
      const midUnique = midResolved.filter(
        (m, i, arr) => arr.findIndex((x) => x.name === m.name) === i,
      );

      if (midUnique.length === 0) {
        addLink(firstNode, lastNode);
      } else {
        for (const m of midUnique) {
          const midNode = ensureNode(`M::${m.name}`, m.name, 1, {
            ruolo: "mezzo",
            adId: m.adId,
            etichetta: m.name,
            raggruppato: m.raggruppato,
          });
          addLink(firstNode, midNode);
          addLink(midNode, lastNode);
        }
      }
    }

    const links: SankeyLink[] = [...linkAgg.entries()].map(([k, value]) => {
      const [s, t] = k.split("->").map(Number);
      return { source: s, target: t, value };
    });

    return { nodes, links };
  }, [journeys, adRanking, topN]);

  const NodeRenderer = useMemo(() => makeNodeRenderer(onNodeClick), [onNodeClick]);

  if (data.links.length === 0) return null;

  return (
    <div className="w-full" style={{ height: 420 }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={data}
          nodePadding={18}
          nodeWidth={14}
          margin={{ top: 10, right: 140, bottom: 10, left: 140 }}
          link={{ stroke: "oklch(0.58 0.13 235 / 0.22)" }}
          node={NodeRenderer}
        >
          <Tooltip
            formatter={(value: number) => [`${value} persone`, ""]}
            labelFormatter={() => ""}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}

function makeNodeRenderer(onNodeClick?: (n: SankeyNodeClick) => void) {
  return function SankeyNodeShape(props: unknown) {
    const p = props as {
      x: number;
      y: number;
      width: number;
      height: number;
      index: number;
      payload: { name: string; column?: number; value: number; meta?: SankeyNodeClick };
      containerWidth: number;
    };
    const { x, y, width, height, payload } = p;
    const labelLeft = (payload.column ?? 0) === 0;
    const clickable = !!onNodeClick && !!payload.meta;
    const handleClick = () => {
      if (clickable) onNodeClick!(payload.meta!);
    };
    return (
      <Layer>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.meta?.raggruppato ? COLORE_GRUPPO : COLORE_ANNUNCIO}
          fillOpacity={0.9}
          cursor={clickable ? "pointer" : "default"}
          onClick={handleClick}
        />
        <text
          x={labelLeft ? x - 8 : x + width + 8}
          y={y + height / 2}
          textAnchor={labelLeft ? "end" : "start"}
          dominantBaseline="middle"
          fontSize={11}
          fill="currentColor"
          className="text-foreground"
          cursor={clickable ? "pointer" : "default"}
          onClick={handleClick}
        >
          <tspan fontWeight={600}>{payload.name}</tspan>
          <tspan dx={6} className="fill-muted-foreground" fillOpacity={0.7}>
            {payload.value}
          </tspan>
        </text>
      </Layer>
    );
  };
}
