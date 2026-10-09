/** ── /CRM/kpi — UNA PAGINA SOLA, QUATTRO DOMANDE ───────────────────────────
 *
 *  ── IL DIFETTO DA CUI DISCENDEVA TUTTO ───────────────────────────────────
 *  La stessa pagina conteneva DUE VOLTE gli stessi quattro numeri — costo per
 *  lead, costo per cliente, ritorno sulla spesa, netto — calcolati su due spese
 *  diverse: la «Panoramica» sulla sola spesa sincronizzata da Meta più una
 *  stima TikTok, «KPI manuale» sulla sola spesa scritta a mano. Stesso periodo,
 *  due «costo per cliente». Chi cambiava linguetta vedeva il numero muoversi e
 *  concludeva che la pagina era rotta — e da lì in poi non credeva più nemmeno
 *  agli altri.
 *  Adesso la spesa è UNA SOLA (src/crm/kpi/spesa.ts), il costo per cliente è
 *  uno solo, e la pagina dichiara quanta parte di quella spesa è davvero
 *  registrata.
 *
 *  ── DUE PERSONE, DUE DOMANDE, QUATTRO SCHEDE ──────────────────────────────
 *  Il TITOLARE chiede quanto ha speso, quanto è entrato e quanto gli costa un
 *  cliente; il CONSULENTE chiede come sta andando lui. Mescolarle è il motivo
 *  per cui la pagina non si usava. Ogni scheda è una domanda e ha UN numero
 *  principale:
 *   · Ritorno    → «quanto rende quello che spendo»       → costo per cliente
 *   · Fonti      → «da dove arrivano i clienti buoni»      → conversione totale
 *   · Chiamate   → «quante telefonate diventano appunt.»   → appunt. ogni 100
 *   · Consulenti → «chi sta lavorando meglio»              → chiusura sulle
 *                                                            consulenze
 *
 *  ── DUE SCHEDE CHE NON CI SONO PIÙ ────────────────────────────────────────
 *   · «KPI manuale»: registrare la spesa è un GESTO, non una sezione di
 *     analisi. Il modulo vive dentro «Ritorno», nel registro della spesa. Il
 *     vecchio indirizzo /CRM/kpi/manuale reindirizza qui.
 *   · «Da fare»: la coda del lavoro non è un numero e in una pagina di analisi
 *     non c'entra. È tornata la sua pagina, /CRM/avanzamento, dove puntano il
 *     menu, la pagina iniziale e la ricerca ⌘K.
 *
 *  ── COME SONO FATTE LE SCHEDE ─────────────────────────────────────────────
 *  Tutte e quattro vivono sull'indirizzo /CRM/kpi e si scelgono con `?scheda=`.
 *  Il motivo è pratico: l'albero delle rotte di TanStack è generato
 *  (src/routeTree.gen.ts, che non si tocca a mano) e aggiungere file di rotta
 *  senza rigenerarlo porterebbe quegli indirizzi alla pagina «non trovata». Con
 *  il parametro l'indirizzo resta condivisibile e la navigazione è la stessa.
 *
 *  Qui non si calcola niente: si sceglie il periodo, si mostrano le linguette e
 *  si lascia disegnare alla scheda.
 *
 *  ── PERCHÉ IL TITOLO ADESSO È UNA PAROLA SOLA ─────────────────────────────
 *  Sotto «KPI» c'era un paragrafo che cambiava con la linguetta e spiegava la
 *  scheda aperta. Diceva cose giuste, ma le diceva a chi era già arrivato: chi
 *  usa questa pagina ogni mattina lo ha letto una volta a settembre e da allora
 *  gli passa sopra con gli occhi. Peggio, ripeteva parola per parola quello che
 *  adesso c'è scritto sulla linguetta accesa, due centimetri più sotto e sempre
 *  visibile perché la barra è fissa. Due testi che dicono la stessa cosa non si
 *  leggono il doppio: si imparano a saltare tutti e due.
 *  Quindi la riga di spiegazione non è stata accorciata, è stata TOLTA, e la
 *  frase lunga è finita nel `title` della linguetta — zero pixel, resta lì per
 *  chi passa sopra col mouse la prima volta.
 *  «KPI» invece resta, e resta com'è: è il nome che si legge nel menu, nella
 *  ricerca ⌘K e nella linguetta del browser. Ribattezzarlo «Numeri» o
 *  «Andamento» avrebbe rotto la corrispondenza fra la voce che si preme e la
 *  pagina dove si atterra, che è l'unica cosa che quel titolo deve fare. Non
 *  essendo più fisso (sta sopra la barra sticky) se ne va scorrendo: giusto
 *  così, è la riga che nessuno rilegge. Quello che deve restare vero mentre si
 *  scorre — dove sono e su che finestra guardo — è la barra, e la barra resta.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarraAzioni, Pagina, Titolo } from "@/crm/ui";
import {
  INTERVALLI,
  SCHEDA_PREDEFINITA,
  leggiRicercaKpi,
  periodoDi,
  schedaDi,
  type RicercaKpi,
  type SchedaKpi,
} from "@/crm/kpi/periodo";

export const Route = createFileRoute("/CRM/kpi")({
  //  Il parametro sta sul RAMO e non sulle singole schede: così cambiando
  //  linguetta il periodo non si azzera, e resta valido anche sulla rotta
  //  figlia /CRM/kpi/manuale finché quel vecchio indirizzo reindirizza qui.
  validateSearch: (raw: Record<string, unknown>): RicercaKpi => leggiRicercaKpi(raw),
  component: RamoKpi,
});

/** ── LE LINGUETTE ──────────────────────────────────────────────────────────
 *  L'ordine è quello in cui si scende dal denaro al lavoro: prima quanto rende
 *  la spesa, poi da dove arrivano i contatti, poi il telefono, in fondo le
 *  persone.
 *
 *  ── COME FAR CAPIRE UNA LINGUETTA A CHI NON L'HA MAI PREMUTA ──────────────
 *  «Fonti», «Ritorno», da soli, non dicono niente a chi apre la pagina la prima
 *  volta: sembrano quattro sinonimi di «numeri». I modi per rimediare erano
 *  tre, e ne abbiamo preso UNO SOLO — prenderne due o tre avrebbe rimesso in
 *  pagina esattamente il rumore che stavamo togliendo.
 *
 *   · Il NUMERO sulla linguetta («Ritorno · 412 € a cliente») era il più
 *     goloso, ed è quello scartato per primo. ⚠️ Per stamparlo, questo
 *     contenitore dovrebbe calcolarsi da sé i numeri delle quattro schede: due
 *     posti che contano la stessa cosa, ed è ALLA LETTERA il difetto raccontato
 *     in cima a questo file, quello per cui la pagina aveva due «costo per
 *     cliente» e nessuno le credeva più. Basterebbe un arrotondamento diverso
 *     fra la linguetta e la scheda per far ricominciare tutto. Vietato.
 *   · Il SEGNO (un'icona per scheda) funziona per «Chiamate» e «Consulenti» —
 *     una cornetta, delle persone — e non funziona per «Ritorno» e «Fonti»,
 *     che sono idee, non oggetti. Un'icona che va indovinata non spiega: va
 *     imparata, cioè chiede tempo proprio a chi non ne ha ancora dato.
 *   · La RIGA DI DESCRIZIONE dice la cosa con le parole della cosa, si legge
 *     senza istruzioni e costa una riga di altezza. Presa questa.
 *
 *  `domanda` è quella riga, e deve restare corta come sta qui (tre-cinque
 *  parole): allungarla di mezza frase moltiplicato quattro rifà il paragrafo
 *  che abbiamo appena cancellato dalla testata.
 *  `dettaglio` è la frase lunga di prima. Non si vede: sta nel `title`, quindi
 *  compare al passaggio del mouse per chi vuole saperne di più e non occupa
 *  spazio per gli altri dodici mesi dell'anno. */
interface Linguetta {
  scheda: SchedaKpi;
  titolo: string;
  domanda: string;
  dettaglio: string;
}

const LINGUETTE: Linguetta[] = [
  {
    scheda: "ritorno",
    titolo: "Ritorno",
    domanda: "Quanto rende la spesa",
    dettaglio:
      "Quanto rende quello che spendo: costo per cliente, ritorno sulla spesa, quanto resta — su una spesa sola, dichiarando quanta parte è davvero registrata",
  },
  {
    scheda: "fonti",
    titolo: "Fonti",
    domanda: "Da dove arrivano i clienti",
    dettaglio:
      "Da dove arrivano i clienti buoni: quanti dei lead entrati diventano clienti, canale per canale, e chi porta le persone che scottano di più",
  },
  {
    scheda: "chiamate",
    titolo: "Chiamate",
    domanda: "Chiamate che vanno in agenda",
    dettaglio:
      "Quante telefonate diventano appuntamenti: su cento contatti chiamati di una lista importata, quanti finiscono in agenda e dove si perdono gli altri",
  },
  {
    scheda: "consulenti",
    titolo: "Consulenti",
    domanda: "Chi sta lavorando meglio",
    dettaglio:
      "Chi sta lavorando meglio: di dieci persone che si presentano in consulenza quante comprano, e chi alza o abbassa quel numero",
  },
];

function RamoKpi() {
  const ricerca = Route.useSearch();
  const periodo = periodoDi(ricerca);
  const schedaAttiva = schedaDi(ricerca);

  return (
    <Pagina larga>
      <Titolo testo="KPI" icona={Activity} />

      {/* ── LINGUETTE E PERIODO, NELLA STESSA BARRA ──────────────────────────
          Sono le due cose che restano vere mentre si scorre: dove sono e su
          quale finestra sto guardando. Le barre delle singole schede non sono
          più appiccicate in alto, altrimenti si accavallerebbero a questa.

          ⚠️ Le due righe adesso hanno DUE FORME DIVERSE apposta, ed è metà del
          motivo per cui prima le linguette sparivano: erano pastiglie identiche
          alle nove del periodo, e l'occhio si trovava davanti tredici oggetti
          uguali in fila senza un modo per capire che i primi quattro cambiano
          capitolo e gli altri nove cambiano solo la finestra. Ora un capitolo è
          un blocco su due righe, un filtro è una pastiglia piccola: la forma
          dice il grado prima che si legga la parola. Se un giorno si tocca il
          periodo, non riportarlo alla forma delle linguette. */}
      <BarraAzioni className="flex-col items-stretch gap-2">
        {/*  ── DOVE STANNO LE QUATTRO LINGUETTE SU UNO SCHERMO PICCOLO ───────
            Griglia, non riga che scorre. ⚠️ Un `overflow-x-auto` qui sarebbe
            stato il gesto comodo e il danno esatto che stiamo riparando: le
            linguette fuori bordo diventano invisibili, e il committente si
            lamenta proprio che non si capisce che dietro ognuna c'è un
            capitolo diverso — una che non si vede non è un capitolo, è niente.
            Quindi: quattro colonne quando c'è posto, DUE (due righe da due)
            sotto i 768 px, che è il portatile stretto e il tablet in verticale.
            Si perde una quarantina di pixel d'altezza e si tengono in vista
            tutte e quattro, che è lo scambio giusto.
            La griglia serve anche a un secondo scopo: pareggia da sola
            l'altezza delle celle, così quando su schermo stretto la riga di
            descrizione va a capo su una sola linguetta le altre tre non
            restano più basse e sfalsate. */}
        <nav aria-label="Sezioni dei KPI" className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
          {LINGUETTE.map((l) => {
            const attivaQuesta = l.scheda === schedaAttiva;
            //  Il periodo viaggia con la linguetta: cambiare scheda non deve
            //  riportare la finestra a trenta giorni sotto gli occhi di chi
            //  stava guardando ieri.
            return (
              <Link
                key={l.scheda}
                to="/CRM/kpi"
                search={{
                  periodo,
                  scheda: l.scheda === SCHEDA_PREDEFINITA ? undefined : l.scheda,
                }}
                //  Chi legge con la sintesi vocale non vede né il rilievo né il
                //  trattino: `aria-current` è il modo in cui gli diciamo la
                //  stessa cosa. È l'idioma che il CRM usa già nel menu di
                //  sinistra e nel selettore di stato.
                aria-current={attivaQuesta ? "page" : undefined}
                title={l.dettaglio}
                //  ⚠️ Bordo e padding IDENTICI nei due stati (l'inattiva ha il
                //  bordo trasparente, non «niente bordo»): se cambiassero, il
                //  testo di tutte e quattro scivolerebbe di un paio di pixel a
                //  ogni clic, e quel sobbalzo si nota molto più della linguetta
                //  che si accende.
                //  ⚠️ Il grigio dell'inattiva è `bg-muted` pieno, non annacquato:
                //  la barra sotto è bianca (bg-card) e con un `bg-muted/60` lo
                //  scalino di luminosità scende a un paio di punti — sullo
                //  schermo del portatile, alla luce del negozio, sparisce, e con
                //  lui sparisce tutto il rilievo su cui si regge il «sei qui».
                className={cn(
                  "relative block rounded-lg border px-3 py-2 pl-4 text-left transition",
                  attivaQuesta
                    ? "border-border bg-card shadow-sm"
                    : "border-transparent bg-muted hover:bg-accent",
                )}
              >
                {/*  ── DOVE SONO, SENZA DOVER LEGGERE ─────────────────────────
                    Quattro segnali che dicono la stessa cosa, e tre su quattro
                    non sono colore: la scheda accesa è l'unica in RILIEVO
                    (fondo bianco, bordo, ombra) mentre le altre tre restano
                    incassate nel grigio della barra; è l'unica col titolo in
                    grassetto scuro; ed è l'unica col trattino a sinistra. Chi
                    distingue male i colori vede comunque un blocco che sporge
                    fra tre che rientrano.
                    Il trattino azzurro è lo stesso identico segno con cui il
                    menu di sinistra dice «sei qui»: due parti dell'app che si
                    inventano due lingue diverse per la stessa frase costringono
                    a impararle tutte e due. */}
                {attivaQuesta && (
                  <span className="pointer-events-none absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-sky-500" />
                )}
                <span
                  className={cn(
                    "block truncate text-[13px] leading-tight",
                    attivaQuesta
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {l.titolo}
                </span>
                {/*  ⚠️ Niente `truncate` su questa riga: esiste solo per
                    spiegare, e una spiegazione tagliata a metà con i puntini
                    non spiega — occupa. Se lo spazio è poco va a capo, ed è per
                    questo che sopra c'è una griglia e non una riga di flex. */}
                <span
                  className={cn(
                    "mt-0.5 block text-[11px] leading-snug",
                    attivaQuesta ? "text-muted-foreground" : "text-muted-foreground/70",
                  )}
                >
                  {l.domanda}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Periodo
          </span>
          {INTERVALLI.map(({ v, t }) => (
            //  `replace`: il periodo si prova, non è una tappa da ritrovare col
            //  tasto indietro. Senza, tornare indietro voleva dire ripercorrere
            //  a ritroso tutte le finestre provate.
            <Link
              key={v}
              to="/CRM/kpi"
              search={{ periodo: v, scheda: ricerca.scheda }}
              replace
              className={cn(
                "inline-flex items-center rounded-lg border px-2.5 py-1 text-[12px] font-medium transition",
                periodo === v
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {t}
            </Link>
          ))}
          <span className="text-[11px] text-muted-foreground">
            {periodo === "ieri"
              ? "«Ieri» parte da ieri all'ora attuale: copre solo la coda della giornata, è la regola del CRM aziendale"
              : "Vale per tutte le schede qui sopra. Finestra mobile: si conta all'indietro da adesso, non dal primo del mese"}
          </span>
        </div>
      </BarraAzioni>

      <Outlet />
    </Pagina>
  );
}
