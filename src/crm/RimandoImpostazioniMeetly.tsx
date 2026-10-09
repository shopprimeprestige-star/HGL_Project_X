/** ─────────────────────────────────────────────────────────────────────────
 *  "QUESTA IMPOSTAZIONE ORA STA IN MEETLY"
 *
 *  Il listino e gli sconti si configuravano da due pagine del gestionale
 *  (/CRM/prezzi e /CRM/sconti). Sono cifre che il cliente vede DURANTE la
 *  consulenza: adesso si impostano dentro Meetly, nel pannello Impostazioni.
 *
 *  PERCHÉ QUESTA SCHERMATA ESISTE INVECE DI CANCELLARE LE PAGINE
 *  Un indirizzo che qualcuno ha nei preferiti — o che la ricerca del CRM
 *  continua a proporre — non si toglie di mezzo: se lo si cancella, chi ci
 *  arriva trova un errore e pensa che il listino sia sparito. Qui invece trova
 *  scritto dove è finito e come aprirlo, in tre passaggi.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Settings2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagina, Scheda, Titolo } from "@/crm/ui";

export function RimandoImpostazioniMeetly({
  icona,
  titolo,
  cosaEra,
  scheda,
}: {
  icona: LucideIcon;
  /** come si chiamava questa pagina nel menu del gestionale */
  titolo: string;
  /** una riga su cosa si faceva qui, per essere sicuri di essere nel posto giusto */
  cosaEra: string;
  /** il nome esatto della scheda da cercare dentro il pannello di Meetly */
  scheda: string;
}) {
  const navigate = useNavigate();
  return (
    <Pagina>
      <Titolo
        testo={titolo}
        nota="Questa impostazione si trova adesso dentro Meetly"
        icona={icona}
      />

      {/*  La riga su "cos'era" sta SOLO nella nota della scheda: ripeterla anche
           nel corpo faceva leggere due volte la stessa frase a chi era arrivato
           qui per sapere dove guardare. */}
      <Scheda
        icona={Settings2}
        titolo={`Ora si imposta da Meetly · scheda "${scheda}"`}
        nota={cosaEra}
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Sono le cifre che il cliente vede mentre siete in consulenza: si impostano dove si
            vende, senza uscire dalla presentazione per venire nel gestionale.
          </p>

          <ol className="space-y-2 text-[13px]">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                1
              </span>
              <span>
                Apri <strong>Meetly</strong> (la pagina della presentazione o del preventivo).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                2
              </span>
              <span>
                Nella barra in basso premi l'ingranaggio <strong>Impostazioni</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                3
              </span>
              <span>
                Scegli la scheda <strong>{scheda}</strong>.
              </span>
            </li>
          </ol>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => navigate({ to: "/presenta" })}>
              Apri Meetly <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            Serve l'accesso da presentatore: il pannello scrive cifre che finiscono davanti a un
            cliente, e per questo non si apre da un browser qualsiasi.
          </p>
        </div>
      </Scheda>
    </Pagina>
  );
}
