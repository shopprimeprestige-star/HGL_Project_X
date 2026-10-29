/** Estratto da `src/routes/CRM.importa.tsx` (commessa 2026-10-28-lead-importati-semplice,
 *  compito T3): le due fasce sotto la lista con lo Stato «Di ritorno».
 *  Solo uno spostamento: nessuna riga di logica è cambiata. */
import { ChevronRight, RotateCcw, PhoneIncoming } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABEL, type Lead } from "@/crm/types";
import { CLASSE_BADGE_STATO, Scheda, classiStato, dettoIlInChiaro } from "@/crm/ui";
import { mappaMestieri } from "@/crm/dafare/di-chi";
import { SchedaRimandati } from "@/crm/importa/SchedaRimandati";

  /** ── SOTTO LA LISTA, CON LO STATO «DI RITORNO» ─────────────────────────
   *  Decisione 6 del piano: la vista «Di ritorno» non ha più una stanza sua ma è
   *  una voce del filtro Stato, e NIENTE SI PERDE. Con quello Stato acceso, sotto
   *  la lista restano i due blocchi di prima: chi ricompare da una lista e
   *  aspetta una decisione (anche con una promessa per un giorno futuro, che in
   *  lista non entra) e chi ha detto «richiamo io». */
export function BloccoRitorno({
  diRitornoFuori,
  diRitorno,
  siFannoViviLoro,
  confermaRitorno,
  rimettiFraIDaContattare,
  setScheda,
  mestieriDelCentro,
  segnaWhatsApp,
}: {
  diRitornoFuori: Lead[];
  diRitorno: Lead[];
  siFannoViviLoro: Lead[];
  confermaRitorno: (l: Lead) => Promise<void>;
  rimettiFraIDaContattare: (l: Lead) => Promise<void>;
  setScheda: (l: Lead) => void;
  mestieriDelCentro: ReturnType<typeof mappaMestieri>;
  segnaWhatsApp: (l: Lead) => Promise<void>;
}) {
  return (
    /*  ── LE DUE FASCE DEL FILTRO STATO «DI RITORNO» ─────────────────────
              Richiesta del committente: «tutte le persone di ritorno stanno nel
              loro filtro». Due fasce, perché sono due famiglie con due gesti
              diversi: chi ricompare da una lista ha le DUE DECISIONI (conferma /
              rimettilo fra i da contattare), chi ha detto che richiama lui no —
              su di lui quelle due scritture non direbbero niente.
              ⚠️ L'elenco e i pulsanti sono gli stessi delle altre due linguette
               (SchedaRimandati): tre copie della stessa riga si scostano al
               primo ritocco, e la stessa persona si leggerebbe in tre modi a
               seconda di dove la guardi. */
    <div className="space-y-3">
      {diRitornoFuori.length > 0 && (
        <SchedaRimandati
          rimandati={diRitornoFuori}
          titolo="Di ritorno"
          nota={`${diRitornoFuori.length === 1 ? "1 contatto" : `${diRitornoFuori.length} contatti`} · ricomparsi in una lista e ancora da decidere${diRitornoFuori.length < diRitorno.length ? " · gli altri sono già nella lista qui sopra" : ""} · appena gli scrivi su WhatsApp si spostano nel loro reparto`}
          icona={RotateCcw}
          vuotoTitolo="Nessun contatto di ritorno da decidere"
          vuotoTesto="Qui finisce chi era già in archivio e ricompare in una lista importata. Appena ne arriva uno lo trovi qui, con le due scelte: confermarlo com'è, o rimetterlo fra i da contattare."
          onConferma={(l) => void confermaRitorno(l)}
          onRimetti={(l) => void rimettiFraIDaContattare(l)}
          onApri={(l) => setScheda(l)}
          nomeConsulente={(id) => mestieriDelCentro.get(String(id ?? ""))?.nome ?? ""}
          onWhatsApp={(l) => void segnaWhatsApp(l)}
        />
      )}
      {/*  ── CHI HA DETTO CHE RICHIAMA LUI ──────────────────────────────
                 La seconda metà di «tutte le persone di ritorno». Qui non ci sono
                 le due decisioni — non avrebbero niente da scrivere — ma c'è
                 quello che serve: chi è, quando l'ha detto, e la sua scheda a un
                 clic. ⚠️ Chi ha la promessa scaduta compare anche in «Oggi»: là
                 è l'orologio, qui è il reparto. */}
      {siFannoViviLoro.length > 0 && (
        <Scheda>
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <PhoneIncoming className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">Si fanno vivi loro</div>
              <div className="text-[11.5px] text-muted-foreground">
                {siFannoViviLoro.length === 1
                  ? "1 persona ha detto"
                  : `${siFannoViviLoro.length} persone hanno detto`}{" "}
                che richiamano loro · non chiamarli, aspettali — ma qui sai chi sono
              </div>
            </div>
          </div>
          <ul className="divide-y">
            {siFannoViviLoro.map((l) => {
              const d = l.data ?? {};
              const quando = dettoIlInChiaro(d);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setScheda(l)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        {`${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome"}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {[String(d.telefono || "") || "senza telefono", quando || null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato), "shrink-0")}>
                      {LEAD_STATUS_LABEL[d.stato]}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Scheda>
      )}
    </div>
  );
}
