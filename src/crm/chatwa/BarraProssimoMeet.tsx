import { ExternalLink, Loader2, Send, Video } from "lucide-react";
import type { ProssimoMeet } from "./prossimo-meet";
import type { ChatItem } from "./tipi";
import { nomeChat } from "./RigaChat";
import { useInvitoMeet } from "./useInvitoMeet";

/** ── IL PROSSIMO MEET, INCOLLATO IN CIMA (30/10/2026) ──────────────────────
 *  Richiesta del titolare: la chat del primo meet della giornata sempre in alto, in un colore suo,
 *  col nome di chi lo farà. Due righe sole (sul telefono ~54 px): «Meet alle 15:00 · Mirko» e sotto
 *  il cliente. Viola, il colore del meet; bordo e icona lo dicono, e la parola «Meet» lo
 *  dice anche a chi non distingue i colori. Niente righetta colorata a lato: è un segno da «avviso». Il tocco apre la chat. Sta nell'area che
 *  scorre con `sticky top-0`: non copre filtri e ricerca, che restano sopra fuori dallo scorrimento.
 *  ── IL TASTO «INVIA INVITO» (31/10/2026) ──
 *  A destra, l'unico tasto pieno della barra (gerarchia: riga 1 meet, riga 2 cliente, azione a
 *  destra); il resto della barra continua ad aprire la chat. Finestra di 24 ore aperta: manda il
 *  testo dalla chat del CRM; chiusa: apre WhatsApp col testo scritto. Senza link o telefono il tasto
 *  è spento e DICE perché. Già mandato oggi: «Rimanda» con l'ora. Le regole: invito-meet.ts.
 *  Le regole di quale chat sia stanno in prossimo-meet.ts. */
export function BarraProssimoMeet({
  meet,
  onApri,
}: {
  meet: ProssimoMeet<ChatItem>;
  onApri: () => void;
}) {
  const cliente = nomeChat(meet.chat);
  const invito = useInvitoMeet(meet.chat, meet.ora, meet.consulente);
  return (
    <div
      role="region"
      aria-label="Prossimo meet"
      className="sticky top-0 z-10 flex items-center border-b border-violet-300 bg-violet-50"
    >
      <button
        type="button"
        onClick={onApri}
        title={`Apri la chat di ${cliente}`}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 self-stretch py-2 pl-3 pr-2 text-left transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-600 lg:pointer-fine:min-h-10 lg:pointer-fine:py-1.5"
      >
        <Video aria-hidden="true" className="h-5 w-5 shrink-0 text-violet-700" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-5 text-violet-950 md:text-[13px]">
            {meet.etichetta}
          </span>
          <span className="block truncate text-[13px] leading-[18px] text-violet-800 md:text-[12px]">
            {cliente}
          </span>
        </span>
      </button>
      <div className="shrink-0 py-1.5 pl-1 pr-3">
        <TastoInvito invito={invito} cliente={cliente} />
      </div>
    </div>
  );
}

const TASTO =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-50";
const TASTO_PIENO = `${TASTO} whitespace-nowrap bg-violet-700 text-white hover:bg-violet-800 active:bg-violet-900`;
/** Già mandato: resta un tasto, ma non più «il» tasto (bordo, non pieno). */
const TASTO_RIMANDA = `${TASTO} whitespace-nowrap border border-violet-400 bg-white text-violet-900 hover:bg-violet-100`;
//  Spento: il motivo può andare su due righe (non spinge fuori la barra).
const TASTO_SPENTO = `${TASTO} max-w-[9rem] cursor-not-allowed py-1 text-center border border-violet-200 bg-violet-100 text-violet-800`;

function TastoInvito({
  invito,
  cliente,
}: {
  invito: ReturnType<typeof useInvitoMeet>;
  cliente: string;
}) {
  const { preparato, strada, fatto, href, inviando, invia, alApriWhatsapp } = invito;
  if (!preparato.ok) {
    //  Il motivo è scritto nel tasto stesso: niente tooltip da indovinare sul telefono.
    return (
      <button type="button" disabled className={TASTO_SPENTO} title={`Invito non possibile: ${preparato.motivo}`}>
        {preparato.motivo}
      </button>
    );
  }
  const nota = fatto ? `${fatto.via === "crm" ? "Inviato" : "Aperto"} alle ${fatto.alle}` : null;
  const classe = fatto ? TASTO_RIMANDA : TASTO_PIENO;
  const dentro = (icona: React.ReactNode, testo: string) => (
    <>
      {icona}
      <span className="flex flex-col items-start">
        <span>{testo}</span>
        {nota && <span className="text-[11px] font-normal leading-3 text-violet-800">{nota}</span>}
      </span>
    </>
  );
  if (strada === "whatsapp") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={alApriWhatsapp}
        className={classe}
        title={`Apre WhatsApp con l'invito per ${cliente} già scritto: premi invio`}
      >
        {dentro(<ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />, fatto ? "Riapri WhatsApp" : "Invia da WhatsApp")}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void invia()}
      disabled={inviando}
      aria-busy={inviando}
      className={`${classe} disabled:cursor-wait disabled:opacity-70`}
      title={`Manda a ${cliente} l'invito per entrare al meet`}
    >
      {inviando
        ? dentro(<Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />, "Invio…")
        : dentro(<Send aria-hidden="true" className="h-4 w-4 shrink-0" />, fatto ? "Rimanda" : "Invia invito")}
    </button>
  );
}
