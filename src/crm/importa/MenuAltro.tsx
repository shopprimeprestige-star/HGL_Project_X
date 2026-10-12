/** ── IL MENU «ALTRO» ───────────────────────────────────────────────────────
 *
 *  Cinque cose che servono ogni tanto e non a ogni telefonata: Tutta la lista
 *  (azioni a gruppi), Ripesca, Doppioni, Note e promemoria, Elenco completo.
 *  Stavano come stanze alla pari della lista da chiamare e la facevano
 *  sembrare una scelta fra dieci; qui dietro un tasto solo.
 *
 *  ⚠️ NIENTE SI TOGLIE: l'elenco delle voci è `ALTRO` in reparti.ts, e la prova
 *   controlla che ci siano tutte e cinque. Ognuna apre la stessa scheda di
 *   prima; «Elenco completo» è un'altra pagina (/CRM/avanzamento).
 *  ⚠️ DI RADIX (`DropdownMenu`): con il menu aperto le scorciatoie 1…9 tacciono
 *   (vedi FiltriLista), quindi un «1» battuto qui non segna nessun esito.
 *  ⚠️ LA VOCE CHE SI STA GUARDANDO SI LEGGE SUL TASTO («Altro · Ripesca»): dentro
 *   una stanza di Altro nessuna linguetta è accesa, e senza questo non si
 *   capirebbe dove si è.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Link } from "@tanstack/react-router";
import { ChevronDown, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALTRO, type Conti, type Vista } from "./reparti";

export function MenuAltro({
  vista,
  conti,
  onVista,
  disabilitato,
}: {
  /** La vista aperta adesso. */
  vista: Vista;
  conti: Conti;
  onVista: (v: Vista) => void;
  /** Mentre una scrittura di gruppo lavora, cambiare vista smonta la scheda che
   *  ha in corso l'operazione. */
  disabilitato?: boolean;
}) {
  const aperta = ALTRO.find((x) => x.vista === vista);
  //  ⚠️ Le note e i richiami scaduti del setter stanno qui dentro: senza il
  //   numero sul tasto si vedrebbero solo aprendo il menu, e una nota scaduta
  //   che nessuno vede è una promemoria che non ha fatto il suo mestiere.
  const noteScadute = Number(conti.oggi ?? 0) || 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={aperta ? "default" : "outline"}
          disabled={disabilitato}
          className="h-8 gap-1.5 text-[12px]"
          title={
            noteScadute > 0
              ? `${noteScadute} note o richiami scaduti in «Note e promemoria»`
              : undefined
          }
        >
          {aperta ? `Altro · ${aperta.nome}` : noteScadute > 0 ? `Altro · ${noteScadute}` : "Altro"}
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {ALTRO.filter((x) => x.vista).map((x) => {
          const n = Number(conti[x.vista as Vista] ?? 0) || 0;
          return (
            <DropdownMenuItem
              key={x.vista}
              title={x.titolo}
              onSelect={() => onVista(x.vista as Vista)}
              className="text-[12.5px]"
            >
              <span className="flex-1">{x.nome}</span>
              {n > 0 && <span className="tabular-nums text-muted-foreground">{n}</span>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {/*  L'Elenco completo è un'altra pagina: un collegamento vero, che si
            apre anche con il clic del tasto centrale. */}
        <DropdownMenuItem asChild className="text-[12.5px]">
          <Link
            to="/CRM/avanzamento"
            title={ALTRO.find((x) => x.href)?.titolo}
            className="flex items-center gap-2"
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="flex-1">Elenco completo</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
