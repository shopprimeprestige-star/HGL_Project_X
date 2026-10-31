/** ── IL PANNELLO «ARCHIVIAZIONE» ────────────────────────────────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T9 (piano d). Un foglio che
 *  si apre dall'intestazione della chat (solo con il permesso «impostazioni», lo
 *  decide `PaginaChat`; la cancellazione la difende comunque il server).
 *
 *  Cosa mostra: lo spazio usato sul tetto, i file per tipo, le chat ordinate per
 *  MB. Cosa si fa: liberare una chat, una selezione dei suoi file, o tutto — SEMPRE
 *  dopo una conferma — a passi, con la barra di avanzamento, fermabile fra un passo
 *  e l'altro e riprendibile se cade. Dopo la liberazione nella chat resta il
 *  segnaposto (lo decide il database, qui non si tocca niente).
 *
 *  ⚠️ Nomi dei file e dei clienti sono testo di altri: sempre nodi di testo, mai HTML.
 *  ⚠️ Nessun import dai file della chat (bolla, foglio media): il contatto con T8 è
 *   l'evento `ponte-media-liberati` (vedi usaArchivio.ts).
 *  `CorpoArchivio` è solo disegno (stato e azioni gli arrivano): così si prova con `react-dom/server`. */
import { useCallback, useEffect, useMemo } from "react";
import { ArrowLeft, FileText, HardDrive, ImageIcon, Loader2, Mic, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { numeroLeggibile } from "./formati";
import type { ChatItem } from "./tipi";
import {
  CHAT_MAX,
  etichettaTipi,
  formatoPeso,
  fraseErrore,
  fraseFile,
  fraseScadenza,
  numero as num,
  type ChatArchivio,
  type Tipo,
  type VoceMedia,
} from "./archivio";
import {
  useNegozioArchivio,
  useStatoArchivio,
  type Archivio,
  type Lavoro,
  type StatoArchivio,
} from "./usaArchivio";

const NOME_TIPO: Record<Tipo, string> = {
  foto: "Foto",
  audio: "Vocale",
  video: "Video",
  documento: "Documento",
};
const ICONA_TIPO = { foto: ImageIcon, audio: Mic, video: Video, documento: FileText } as const;

/** Il tasto dell'intestazione: icona sola sul telefono (44 px), con la parola dal tablet in su. */
export function TastoArchiviazione({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      aria-label="Archiviazione: spazio occupato dai file"
      title="Archiviazione"
      className="h-11 w-11 gap-1.5 px-0 text-xs md:h-8 md:w-auto md:px-3"
    >
      <HardDrive className="h-4 w-4 md:h-3.5 md:w-3.5" />
      <span className="hidden md:inline">Archivio</span>
    </Button>
  );
}

/** «12 ott» (o «12 ott 2025» se non è di quest'anno), nel giorno di Roma. */
function dataBreve(iso: string, adesso: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const stessoAnno = d.getUTCFullYear() === new Date(adesso).getUTCFullYear();
  return d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    ...(stessoAnno ? {} : { year: "numeric" }),
    timeZone: "Europe/Rome",
  });
}

// ── Il pannello ───────────────────────────────────────────────────────────

/** I nomi delle chat già in memoria (`numero` solo cifre → scheda, nome salvato, numero leggibile). */
function nomiDaChat(chats: ChatItem[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of chats) {
    const scheda = c.lead ? `${c.lead.data.nome} ${c.lead.data.cognome}`.trim() : "";
    m.set(
      c.phone.replace(/\D/g, ""),
      scheda || c.contact?.display_name || numeroLeggibile(c.phone),
    );
  }
  return m;
}

export function PannelloArchiviazione({
  aperto,
  onChiudi,
  chats,
}: {
  aperto: boolean;
  onChiudi: () => void;
  chats: ChatItem[];
}) {
  const archivio = useNegozioArchivio();
  if (!archivio) return null;
  return <Contenuto archivio={archivio} aperto={aperto} onChiudi={onChiudi} chats={chats} />;
}

function Contenuto({
  archivio,
  aperto,
  onChiudi,
  chats,
}: {
  archivio: Archivio;
  aperto: boolean;
  onChiudi: () => void;
  chats: ChatItem[];
}) {
  const stato = useStatoArchivio(archivio);
  const nomi = useMemo(() => nomiDaChat(chats), [chats]);
  const nomeDi = useCallback((n: string) => nomi.get(n) ?? numeroLeggibile(n), [nomi]);

  //  Ogni volta che si apre: si torna all'elenco e si rilegge (i file cambiano di continuo).
  useEffect(() => {
    if (!aperto) return;
    archivio.tornaElenco();
    void archivio.carica();
  }, [aperto, archivio]);

  const L = stato.lettura;
  const tutto = stato.conferma?.tipo === "tutto" && L.fase === "ok";

  return (
    <>
      <Sheet open={aperto} onOpenChange={(v) => !v && onChiudi()}>
        <SheetContent
          side="right"
          //  `crm-theme`: il foglio vive in un portale fuori dal CRM (senza, i colori del sito scuro).
          //  La X di serie si nasconde: c'è «Chiudi» da 44 px, come negli altri fogli della chat.
          className="crm-theme flex w-full flex-col gap-0 bg-white p-0 text-foreground sm:max-w-[480px] [&>button]:hidden"
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-border py-1.5 pl-2 pr-1">
            {stato.numero ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-11 shrink-0 px-0"
                aria-label="Torna a tutte le chat"
                onClick={archivio.tornaElenco}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <HardDrive
                aria-hidden="true"
                className="ml-2 h-4 w-4 shrink-0 text-muted-foreground"
              />
            )}
            <SheetTitle className="min-w-0 flex-1 truncate px-1 text-[15px]">
              {stato.numero ? nomeDi(stato.numero) : "Archiviazione"}
            </SheetTitle>
            <SheetClose asChild>
              <Button type="button" variant="ghost" className="min-h-11 shrink-0 text-[13px]">
                Chiudi
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">
            Spazio occupato dai file di WhatsApp, chat per chat. Si possono liberare i file di una
            chat, una selezione o tutti: nelle chat resta il segnaposto.
          </SheetDescription>
          <CorpoArchivio stato={stato} azioni={archivio} nomeDi={nomeDi} adesso={Date.now()} />
        </SheetContent>
      </Sheet>

      {/*  «Libera tutto»: la conferma è una finestra vera. «Annulla» è il tasto che prende il fuoco,
          quello che cancella non è mai il predefinito. */}
      <AlertDialog open={tutto} onOpenChange={(v) => !v && archivio.annulla()}>
        <AlertDialogContent className="crm-theme bg-white text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Liberare tutti i file?</AlertDialogTitle>
            <AlertDialogDescription>
              {L.fase === "ok" && (
                <TestoConfermaTutto file={L.riassunto.file} byte={L.riassunto.byteTotali} />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void archivio.conferma()}
            >
              Sì, libera tutto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Il testo della conferma di «Libera tutto» (a parte, perché la finestra sta in un portale). */
export function TestoConfermaTutto({ file, byte }: { file: number; byte: number }) {
  return (
    <>
      Elimino {fraseFile(file)} ({formatoPeso(byte)}) da tutte le chat. Nelle chat resta il
      segnaposto; riaverli con «Mostra» è possibile solo per i messaggi recenti.
    </>
  );
}

// ── Il corpo ──────────────────────────────────────────────────────────────

export function CorpoArchivio({
  stato,
  azioni,
  nomeDi,
  adesso,
}: {
  stato: StatoArchivio;
  azioni: Archivio;
  nomeDi: (numero: string) => string;
  adesso: number;
}) {
  const L = stato.lettura;
  const occupato = stato.lavoro?.fase === "in_corso";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {stato.lavoro && <AvanzamentoLavoro lavoro={stato.lavoro} azioni={azioni} />}

      {L.fase === "carico" && <Scheletri />}

      {L.fase === "errore" && (
        <div role="alert" className="flex flex-col items-start gap-3 px-4 py-6">
          <p className="text-[13px] text-foreground">{L.frase}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void azioni.carica()}
          >
            Riprova
          </Button>
        </div>
      )}

      {L.fase === "ok" &&
        (stato.numero ? (
          <DettaglioChat
            stato={stato}
            chat={L.chat.find((x) => x.numero === stato.numero)}
            azioni={azioni}
            occupato={occupato}
            adesso={adesso}
          />
        ) : (
          <Elenco stato={stato} lettura={L} azioni={azioni} nomeDi={nomeDi} occupato={occupato} />
        ))}
    </div>
  );
}

/** La barra con il suo valore letto da chi non la vede: il `Progress` di serie non lo passa al ruolo `progressbar`. */
function Barra({
  valore,
  etichetta,
  className,
}: {
  valore: number;
  etichetta: string;
  className?: string;
}) {
  return (
    <Progress value={valore} aria-label={etichetta} aria-valuenow={valore} className={className} />
  );
}

function Scheletri() {
  return (
    <div aria-busy="true" aria-label="Carico l'archivio" className="space-y-4 px-4 py-4">
      <Skeleton className="h-7 w-32 motion-reduce:animate-none" />
      <Skeleton className="h-2 w-full motion-reduce:animate-none" />
      <div className="space-y-3 pt-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}

/** Quanto è avanti il lavoro, 0-100. */
const percento = (l: Lavoro) => {
  const totale = Math.max(l.previsti, l.liberati + (l.restano ?? 0));
  return totale > 0 ? Math.min(100, Math.round((l.liberati / totale) * 100)) : 0;
};

function AvanzamentoLavoro({ lavoro: l, azioni }: { lavoro: Lavoro; azioni: Archivio }) {
  const totale = Math.max(l.previsti, l.liberati + (l.restano ?? 0));
  const nonRiusciti =
    l.nonRiusciti > 0 ? (
      <p className="text-[12px] text-muted-foreground">
        {fraseFile(l.nonRiusciti)} non {l.nonRiusciti === 1 ? "è riuscito" : "sono riusciti"}:
        restano nell&apos;archivio.
      </p>
    ) : null;

  if (l.fase === "in_corso") {
    return (
      <div
        role="status"
        className="shrink-0 space-y-2 border-b border-border bg-muted/40 px-4 py-3"
      >
        <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Libero… {num(l.liberati)} di {fraseFile(totale)}
        </p>
        <Barra valore={percento(l)} etichetta="Avanzamento della liberazione" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] tabular-nums text-muted-foreground">
            {formatoPeso(l.byte)} liberati
          </p>
          <Button type="button" variant="outline" className="min-h-11" onClick={azioni.ferma}>
            Ferma
          </Button>
        </div>
      </div>
    );
  }

  if (l.fase === "finito") {
    return (
      <div
        role="status"
        className="shrink-0 space-y-1 border-b border-border bg-muted/40 px-4 py-3"
      >
        <p className="text-[13px] font-medium text-foreground">
          Fatto: liberati {fraseFile(l.liberati)} ({formatoPeso(l.byte)}).
        </p>
        {nonRiusciti}
        <Button
          type="button"
          variant="ghost"
          className="-ml-3 min-h-11"
          onClick={azioni.chiudiEsito}
        >
          Chiudi
        </Button>
      </div>
    );
  }

  //  fermato o caduto: si dice quanto è già andato e si può riprendere
  const resto = l.restano !== null ? ` Ne restano ${fraseFile(l.restano)}.` : "";
  return (
    <div
      role="alert"
      className="shrink-0 space-y-1 border-b border-amber-200 bg-amber-50 px-4 py-3"
    >
      <p className="text-[13px] font-medium text-amber-950">
        {l.fase === "fermato" ? "Fermato." : l.motivo ? fraseErrore(l.motivo) : "Si è interrotto."}
      </p>
      <p className="text-[12.5px] text-amber-950">
        Liberati finora {fraseFile(l.liberati)} ({formatoPeso(l.byte)}).{resto}
      </p>
      {nonRiusciti}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void azioni.riprendi()}
        >
          Riprendi
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={azioni.chiudiEsito}>
          Chiudi
        </Button>
      </div>
    </div>
  );
}

// ── L'elenco delle chat ───────────────────────────────────────────────────

function Elenco({
  stato,
  lettura,
  azioni,
  nomeDi,
  occupato,
}: {
  stato: StatoArchivio;
  lettura: Extract<StatoArchivio["lettura"], { fase: "ok" }>;
  azioni: Archivio;
  nomeDi: (numero: string) => string;
  occupato: boolean;
}) {
  const { riassunto: R, chat, piuDi2000, tettoByte } = lettura;
  const perc = tettoByte ? Math.min(100, Math.round((R.byteTotali / tettoByte) * 100)) : null;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <section aria-label="Spazio usato" className="border-b border-border px-4 py-4">
        <p className="text-[12px] text-muted-foreground">Spazio usato</p>
        <p className="text-[28px] font-semibold leading-tight tabular-nums text-foreground">
          {formatoPeso(R.byteTotali)}
          {tettoByte && (
            <span className="ml-2 text-[13px] font-normal text-muted-foreground">
              di {formatoPeso(tettoByte)}
            </span>
          )}
        </p>
        {perc !== null && (
          <Barra
            valore={perc}
            etichetta="Spazio usato sul tetto"
            className={cn("mt-2 h-1.5", perc >= 90 && "[&>div]:bg-amber-500")}
          />
        )}
        {R.file > 0 && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {(["foto", "audio", "video", "documento"] as const).map((t) => (
                <div key={t}>
                  <dt className="text-[12px] text-muted-foreground">
                    {t === "audio" ? "Vocali" : t === "documento" ? "Documenti" : NOME_TIPO[t]}
                  </dt>
                  <dd className="text-[13px] tabular-nums text-foreground">
                    {fraseFile(R.perTipo[t].n)} · {formatoPeso(R.perTipo[t].byte)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-muted-foreground">
              {num(R.conTimer)} con timer · {num(R.liberati)} già liberati
            </p>
          </>
        )}
        {R.file > 0 && (
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={occupato}
            onClick={() => azioni.chiedi({ tipo: "tutto" })}
          >
            Libera tutto…
          </Button>
        )}
      </section>

      <section aria-labelledby="arch-chat">
        <h3 id="arch-chat" className="px-4 pb-1 pt-4 text-[12px] font-medium text-muted-foreground">
          Chat per spazio
        </h3>
        {chat.length === 0 ? (
          <div className="px-4 py-8">
            <p className="text-[14px] font-medium text-foreground">Nessun file in archivio</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Foto, vocali, video e documenti scaricati dalle chat compaiono qui.
            </p>
          </div>
        ) : (
          <ul>
            {chat.map((x) => (
              <RigaChatArchivio
                key={x.numero}
                chat={x}
                nome={nomeDi(x.numero)}
                inConferma={stato.conferma?.tipo === "chat" && stato.conferma.numero === x.numero}
                occupato={occupato}
                azioni={azioni}
              />
            ))}
          </ul>
        )}
        {piuDi2000 && (
          <p className="px-4 py-3 text-[12px] text-muted-foreground">
            Sono elencate le {num(CHAT_MAX)} chat con più spazio, ce ne sono altre. «Libera tutto»
            le libera tutte.
          </p>
        )}
      </section>
    </div>
  );
}

const fileDi = (c: ChatArchivio) => c.foto + c.audio + c.video + c.documento;

function RigaChatArchivio({
  chat,
  nome,
  inConferma,
  occupato,
  azioni,
}: {
  chat: ChatArchivio;
  nome: string;
  inConferma: boolean;
  occupato: boolean;
  azioni: Archivio;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 pl-4 pr-3">
        <button
          type="button"
          onClick={() => void azioni.apriChat(chat.numero)}
          className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="w-full truncate text-[14px] font-medium text-foreground">{nome}</span>
          <span className="w-full text-[12px] leading-snug text-muted-foreground">
            {etichettaTipi(chat)}
          </span>
        </button>
        <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
          {formatoPeso(chat.byte)}
        </span>
        {!inConferma && (
          <Button
            type="button"
            variant="outline"
            aria-label={`Libera la chat di ${nome}`}
            className="min-h-11 shrink-0 px-3"
            disabled={occupato}
            onClick={() => azioni.chiedi({ tipo: "chat", numero: chat.numero })}
          >
            Libera
          </Button>
        )}
      </div>
      {inConferma && (
        <ConfermaInRiga
          testo={`Libero ${fraseFile(fileDi(chat))} (${formatoPeso(chat.byte)})? Nella chat restano i segnaposto.`}
          azioni={azioni}
        />
      )}
    </li>
  );
}

/** La domanda «sei sicuro?» sotto la riga o sopra i tasti: chi cancella non è il tasto che prende il fuoco. */
function ConfermaInRiga({ testo, azioni }: { testo: string; azioni: Archivio }) {
  return (
    <div className="space-y-2 px-4 pb-3">
      <p className="text-[13px] text-foreground">{testo}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          className="min-h-11"
          onClick={() => void azioni.conferma()}
        >
          Sì, libera
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          autoFocus
          onClick={azioni.annulla}
        >
          Annulla
        </Button>
      </div>
    </div>
  );
}

// ── Una chat: i suoi file ─────────────────────────────────────────────────

function DettaglioChat({
  stato,
  chat,
  azioni,
  occupato,
  adesso,
}: {
  stato: StatoArchivio;
  chat: ChatArchivio | undefined;
  azioni: Archivio;
  occupato: boolean;
  adesso: number;
}) {
  const { media, scelte, conferma } = stato;
  const pesoScelte = media.voci
    .filter((v) => scelte.includes(v.chiave))
    .reduce((s, v) => s + v.byte, 0);
  const tutteScelte = media.voci.length > 0 && scelte.length === media.voci.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        {chat ? (
          <>
            <p className="text-[13px] tabular-nums text-foreground">
              {fraseFile(fileDi(chat))} · {formatoPeso(chat.byte)}
            </p>
            <p className="text-[12px] text-muted-foreground">{etichettaTipi(chat)}</p>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">Questa chat non ha più file.</p>
        )}
        {media.voci.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={occupato}
              onClick={azioni.scegliTutte}
            >
              {tutteScelte ? "Deseleziona tutti" : "Seleziona tutti"}
            </Button>
            {chat && conferma?.tipo !== "chat" && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={occupato}
                onClick={() => azioni.chiedi({ tipo: "chat", numero: chat.numero })}
              >
                Libera tutta la chat
              </Button>
            )}
          </div>
        )}
      </div>
      {chat && conferma?.tipo === "chat" && (
        <div className="shrink-0 border-b border-border pt-3">
          <ConfermaInRiga
            testo={`Libero ${fraseFile(fileDi(chat))} (${formatoPeso(chat.byte)})? Nella chat restano i segnaposto.`}
            azioni={azioni}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {media.fase === "carico" && <Scheletri />}
        {media.fase === "errore" && (
          <div role="alert" className="flex flex-col items-start gap-3 px-4 py-6">
            <p className="text-[13px] text-foreground">
              Non riesco a leggere i file di questa chat.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => stato.numero && void azioni.apriChat(stato.numero)}
            >
              Riprova
            </Button>
          </div>
        )}
        {media.fase === "ok" && media.voci.length === 0 && (
          <p className="px-4 py-8 text-[13px] text-muted-foreground">Nessun file in questa chat.</p>
        )}
        {media.voci.length > 0 && (
          <ul>
            {media.voci.map((v) => (
              <RigaMedia
                key={v.chiave}
                voce={v}
                scelta={scelte.includes(v.chiave)}
                occupato={occupato}
                azioni={azioni}
                adesso={adesso}
              />
            ))}
          </ul>
        )}
        {media.fase === "ok" && !media.fine && (
          <div className="px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={media.altre}
              onClick={() => void azioni.altre()}
            >
              Carica altri
            </Button>
          </div>
        )}
      </div>

      {scelte.length > 0 && (
        <div className="shrink-0 border-t border-border bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {conferma?.tipo === "selezione" ? (
            <ConfermaInRiga
              testo={`Libero ${fraseFile(scelte.length)} (${formatoPeso(pesoScelte)})? Nella chat restano i segnaposto.`}
              azioni={azioni}
            />
          ) : (
            <div className="flex gap-2 px-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={occupato}
                onClick={() => azioni.chiedi({ tipo: "selezione" })}
              >
                Libera selezionati ({num(scelte.length)}, {formatoPeso(pesoScelte)})
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={occupato}
                onClick={azioni.svuota}
              >
                Deseleziona
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RigaMedia({
  voce: v,
  scelta,
  occupato,
  azioni,
  adesso,
}: {
  voce: VoceMedia;
  scelta: boolean;
  occupato: boolean;
  azioni: Archivio;
  adesso: number;
}) {
  const Icona = ICONA_TIPO[v.categoria];
  const scade = fraseScadenza(v.scadeIl, adesso);
  const durata = v.durataS
    ? `${Math.floor(v.durataS / 60)}:${String(v.durataS % 60).padStart(2, "0")}`
    : null;
  return (
    <li className="border-b border-border last:border-b-0">
      <label
        className={cn(
          "flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2",
          scelta && "bg-accent/60",
          occupato && "cursor-default opacity-60",
        )}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={scelta}
          disabled={occupato}
          onChange={() => azioni.scegli(v.chiave)}
        />
        <span
          aria-hidden="true"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm border border-input bg-background text-transparent peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
        >
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
          </svg>
        </span>
        {v.miniatura ? (
          <img
            src={`data:image/jpeg;base64,${v.miniatura}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-11 w-11 shrink-0 rounded-md bg-muted object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
          >
            <Icona className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] text-foreground">
            {v.nome ?? NOME_TIPO[v.categoria]}
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">
            {[
              v.nome ? NOME_TIPO[v.categoria] : null,
              durata,
              formatoPeso(v.byte),
              dataBreve(v.creatoIl, adesso),
              scade ? `si elimina ${scade}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </label>
    </li>
  );
}
