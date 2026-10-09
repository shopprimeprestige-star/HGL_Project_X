/** ─────────────────────────────────────────────────────────────────────────
 *  VideoFunnelChart — «fino a che punto guardano il video»
 *
 *  COSA È CAMBIATO, E PERCHÉ
 *   · PARLAVA INGLESE. «Thumbstop», «Hook», «Hold», «Completion», «Thruplay»,
 *     «Drop-off»: cinque parole che nessuno che vende impianti di capelli ha
 *     motivo di conoscere, e che nel grafico erano anche ruotate di 15 gradi a
 *     10px. Adesso i gradini si chiamano «ha fatto partire il video», «arrivato
 *     a metà», «ha visto tutto»: si capisce cosa è successo senza legenda.
 *   · IL GRAFICO NON SI LEGGEVA SU UN TELEFONO. Sette colonne verticali con le
 *     etichette inclinate sotto: su 360px restavano sette barrette senza nome.
 *     Le stesse sette righe in orizzontale — nome, percentuale, quante persone,
 *     barretta lunga quanto il valore — si leggono a qualunque larghezza e non
 *     hanno bisogno di una libreria di grafici per esistere.
 *   · IL COLORE ERA DECORAZIONE. Sette tinte da blu a giallo dicevano solo
 *     «questa è la barra numero 4». Ora la barretta è di una tinta sola e il
 *     colore compare unicamente dove c'è un giudizio: verde se il gradino è
 *     sopra il riferimento, ambra se è sotto.
 *   · NIENTE TESTO SOTTO GLI 11px, come nel resto del CRM.
 *
 *  IL CONTO (invariato): ogni gradino è una percentuale sulle visualizzazioni,
 *  non sul gradino precedente. È il modo standard di leggerlo e NON è il dato
 *  proprietario di Meta, che cambia definizione da una metrica all'altra.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Scheda } from "@/crm/ui";

interface VideoFunnel {
  impressions: number;
  videoPlays: number;
  v25: number;
  v50: number;
  v75: number;
  v100: number;
  thruplays: number;
}

const conta = (v: number) => Math.round(v).toLocaleString("it-IT");
const perc = (v: number) => `${v.toFixed(1)}%`;

interface Gradino {
  nome: string;
  /** cosa vuol dire, per chi non ha mai aperto Gestione inserzioni */
  spiega: string;
  valore: number;
  quota: number;
  /** sopra questa quota il gradino è considerato buono; assente = nessun giudizio */
  riferimento?: number;
  /**  «Almeno 15 secondi» non è un gradino della scala: conta anche chi ha
   *   visto tutto un video da 12 secondi, quindi può essere più alto del
   *   gradino sopra. Confrontarlo col precedente darebbe «prosegue il 240%». */
  fuoriCatena?: boolean;
}

export function VideoFunnelChart({ data }: { data: VideoFunnel }) {
  const viste = data.impressions;

  if (viste === 0) {
    return (
      <Scheda
        titolo="Fino a che punto guardano il video"
        nota="Nessuna visualizzazione nel periodo"
      >
        <p className="py-6 text-center text-[12.5px] text-muted-foreground">
          Questo annuncio non è stato mostrato a nessuno nel periodo scelto.
        </p>
      </Scheda>
    );
  }

  const su = (v: number) => (viste > 0 ? (v / viste) * 100 : 0);

  const gradini: Gradino[] = [
    {
      nome: "L'hanno visto passare",
      spiega: "Quante volte l'annuncio è comparso davanti a qualcuno",
      valore: viste,
      quota: 100,
    },
    {
      nome: "Hanno fatto partire il video",
      spiega: "Si sono fermati invece di scorrere oltre",
      valore: data.videoPlays,
      quota: su(data.videoPlays),
      riferimento: 30,
    },
    {
      nome: "Arrivati al primo quarto",
      spiega: "Hanno guardato il 25% del video",
      valore: data.v25,
      quota: su(data.v25),
      riferimento: 15,
    },
    {
      nome: "Arrivati a metà",
      spiega: "Hanno guardato il 50% del video",
      valore: data.v50,
      quota: su(data.v50),
    },
    {
      nome: "Arrivati a tre quarti",
      spiega: "Hanno guardato il 75% del video: qui c'è di solito l'offerta",
      valore: data.v75,
      quota: su(data.v75),
      riferimento: 5,
    },
    {
      nome: "L'hanno visto tutto",
      spiega: "Sono rimasti fino alla fine",
      valore: data.v100,
      quota: su(data.v100),
      riferimento: 3,
    },
    {
      nome: "Almeno 15 secondi",
      spiega: "Il conteggio di Meta: 15 secondi guardati, o il video intero se è più corto",
      valore: data.thruplays,
      quota: su(data.thruplays),
      fuoriCatena: true,
    },
  ];

  return (
    <Scheda
      titolo="Fino a che punto guardano il video"
      nota={`${conta(viste)} visualizzazioni · ogni gradino è una percentuale su queste`}
      senzaPadding
    >
      <ol className="divide-y divide-border">
        {gradini.map((g, i) => (
          <RigaGradino
            key={g.nome}
            gradino={g}
            /*  Il gradino prima serve a dire quanti hanno proseguito: è la
                domanda vera («dove mi perdono?»), e da sola la percentuale
                sulle visualizzazioni non la risponde. */
            precedente={i > 0 && !g.fuoriCatena ? gradini[i - 1] : null}
          />
        ))}
      </ol>
      <p className="border-t border-border px-3 py-2.5 text-[11px] leading-snug text-muted-foreground sm:px-4">
        Riferimenti per un video corto (meno di 30 secondi): parte il video a più del 30%, primo
        quarto sopra il 15%, tre quarti sopra il 5%, visto tutto sopra il 3%. Sotto questi valori il
        problema è quasi sempre nei primi tre secondi.
      </p>
    </Scheda>
  );
}

function RigaGradino({ gradino, precedente }: { gradino: Gradino; precedente: Gradino | null }) {
  const { nome, spiega, valore, quota, riferimento } = gradino;
  //  Quanti, di quelli arrivati al gradino prima, sono andati avanti. È la
  //  perdita vera, quella su cui si rifà il video.
  const prosegue =
    precedente && precedente.valore > 0 ? Math.min(100, (valore / precedente.valore) * 100) : null;
  const giudizio = riferimento === undefined ? null : quota >= riferimento ? "buono" : "scarso";

  return (
    <li className="px-3 py-2.5 sm:px-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-medium">{nome}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{spiega}</span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={`block text-[14px] font-semibold tabular-nums ${
              giudizio === "buono"
                ? "text-emerald-700"
                : giudizio === "scarso"
                  ? "text-amber-700"
                  : ""
            }`}
          >
            {perc(quota)}
          </span>
          <span className="block text-[11px] tabular-nums text-muted-foreground">
            {conta(valore)}
          </span>
        </span>
      </div>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            giudizio === "buono"
              ? "bg-emerald-500/70"
              : giudizio === "scarso"
                ? "bg-amber-500/70"
                : "bg-sky-500/50"
          }`}
          style={{ width: `${Math.max(quota > 0 ? 1.5 : 0, Math.min(100, quota))}%` }}
        />
      </div>

      {prosegue !== null && (
        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
          Prosegue il {perc(prosegue)} di chi era al gradino prima
        </p>
      )}
    </li>
  );
}
