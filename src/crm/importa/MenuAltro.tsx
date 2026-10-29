/** ── IL MENU «ALTRO» ───────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice»: l'unico posto per le cose
 *  secondarie. Cinque sezioni con un titoletto — In attesa, Fissati da me, Già
 *  lavorati, Liste, Strumenti — dentro un pannello che sul telefono sale dal
 *  basso (`PannelloBasso`). Dalla pagina ogni voce si raggiunge in due tocchi:
 *  «Altro», poi la voce.
 *
 *  Prima c'erano tre linguette, una fila «Già lavorati» di dieci pulsanti e un
 *  menu con cinque voci: stavano tutti in cima e la scheda da chiamare finiva
 *  sotto la piega. Niente si è tolto, si è spostato qui.
 *
 *  ⚠️ NESSUNA SECONDA LISTA: le voci le costruisce `sezioniAltro` (sezioni-altro.ts)
 *   da `LINGUETTE`, `ALTRO` e `ALTRO_FILTRATE` di reparti.ts, quelle che la prova
 *   dei reparti controlla. Qui si disegnano soltanto.
 *  ⚠️ «ELENCO COMPLETO» È UN COLLEGAMENTO VERO (`<Link>`) a /CRM/avanzamento: è
 *   un'altra pagina, e il collegamento si apre anche col clic del tasto centrale.
 *  ⚠️ LA VOCE CHE SI STA GUARDANDO SI LEGGE SUL TASTO («Altro · Ripesca»): dentro
 *   una stanza di Altro nessuna pillola è accesa, e senza questo non si capirebbe
 *   dove si è. Il numero sul tasto sono le note e i richiami scaduti di «Note e
 *   promemoria»: una nota scaduta che nessuno vede non ha fatto il suo mestiere.
 *  ⚠️ UN FOGLIO NON FERMA LE SCORCIATOIE: lo stato `aperto` vive nella pagina ed
 *   entra in `bloccato` di `useScorciatoie` (vedi PannelloBasso).
 *  ───────────────────────────────────────────────────────────────────────── */
import { Link } from "@tanstack/react-router";
import { ChevronDown, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PannelloBasso } from "./PannelloBasso";
import { vocePerVista, type Conti, type Vista } from "./reparti";
import type { SezioneAltro, VoceAltro2 } from "./sezioni-altro";

const RIGA =
  "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50 md:min-h-8 md:text-[12.5px]";

export function MenuAltro({
  sezioni,
  aperto,
  onCambio,
  vista,
  conti,
  origine,
  nGoogleSheets = 0,
  permessi,
  onVoce,
  disabilitato,
}: {
  sezioni: SezioneAltro[];
  aperto: boolean;
  onCambio: (aperto: boolean) => void;
  /** La vista aperta adesso. */
  vista: Vista;
  conti: Conti;
  /** L'Origine dell'indirizzo: con «Tutta la lista» aperta dice quale delle due
   *  voci si sta guardando. */
  origine?: string | null;
  /** Quanti lead sono arrivati dal foglio, da scrivere accanto alla voce. */
  nGoogleSheets?: number;
  /** Chi può caricare e chi può assegnare: le voci con `richiede` si vedono solo con il permesso. */
  permessi: { "lead.crea": boolean; "lead.assegna": boolean };
  onVoce: (v: VoceAltro2) => void;
  /** Mentre una scrittura di gruppo lavora, cambiare vista smonta la scheda che
   *  ha in corso l'operazione. */
  disabilitato?: boolean;
}) {
  const apertaOra = vocePerVista(vista, origine);
  //  ⚠️ Le note e i richiami scaduti del setter stanno qui dentro: senza il
  //   numero sul tasto si vedrebbero solo aprendo il menu.
  const noteScadute = Number(conti.oggi ?? 0) || 0;
  const numeroDi = (v: VoceAltro2): number => {
    if (v.n !== undefined) return v.n;
    const a = v.azione;
    if (!("vista" in a)) return 0;
    if (a.filtro) return nGoogleSheets;
    return Number(conti[a.vista] ?? 0) || 0;
  };
  const eAperta = (v: VoceAltro2): boolean =>
    !!apertaOra && "vista" in v.azione && !v.azione.statoTutti && v.nome === apertaOra.nome;
  return (
    <PannelloBasso
      aperto={aperto}
      onCambio={onCambio}
      titolo="Altro"
      descrizione="Liste, strumenti e le schede già lavorate"
      larghezza="w-80"
      trigger={
        <Button
          type="button"
          variant={apertaOra ? "default" : "outline"}
          size="sm"
          disabled={disabilitato}
          //  Il numero sul tasto non si capisce da solo: a chi legge con la voce
          //  si dice cosa conta.
          aria-label={
            !apertaOra && noteScadute > 0
              ? `Altro, ${noteScadute} ${noteScadute === 1 ? "nota o richiamo scaduto" : "note o richiami scaduti"}`
              : undefined
          }
          className="h-11 shrink-0 gap-1.5 text-[13px] md:h-8 md:text-[12.5px]"
          title={
            noteScadute > 0
              ? `${noteScadute} note o richiami scaduti in «Note e promemoria»`
              : undefined
          }
        >
          {apertaOra ? `Altro · ${apertaOra.nome}` : noteScadute > 0 ? `Altro · ${noteScadute}` : "Altro"}
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Button>
      }
    >
      <nav aria-label="Altro" className="space-y-3">
        {sezioni.map((s) => {
          const voci = s.voci.filter((v) => !v.richiede || permessi[v.richiede]);
          if (voci.length === 0) return null;
          return (
            <section key={s.titolo} aria-label={s.titolo}>
              <h3 className="px-2.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {s.titolo}
              </h3>
              <ul>
                {voci.map((v) => {
                  const n = numeroDi(v);
                  const contenuto = (
                    <>
                      <span className="min-w-0 flex-1 truncate">{v.nome}</span>
                      {n > 0 && <span className="tabular-nums text-muted-foreground">{n}</span>}
                    </>
                  );
                  return (
                    <li key={v.id}>
                      {"href" in v.azione ? (
                        //  L'Elenco completo è un'altra pagina: un collegamento
                        //  vero, che si apre anche con il clic del tasto centrale.
                        <Link
                          to="/CRM/avanzamento"
                          title={v.titolo}
                          onClick={() => onCambio(false)}
                          className={RIGA}
                        >
                          <Table2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{v.nome}</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          title={v.titolo}
                          disabled={disabilitato}
                          aria-current={eAperta(v) ? "page" : undefined}
                          onClick={() => {
                            onCambio(false);
                            onVoce(v);
                          }}
                          className={cn(RIGA, eAperta(v) && "bg-accent font-semibold")}
                        >
                          {contenuto}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>
    </PannelloBasso>
  );
}
