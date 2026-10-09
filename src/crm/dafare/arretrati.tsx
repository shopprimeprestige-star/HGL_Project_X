/** ── L'ORDINE DELL'ARRETRATO — UNA REGOLA SOLA PER DUE SCHERMATE ───────────
 *
 *  L'arretrato sono le cose SCADUTE E NON FATTE: quelle che avevano un giorno,
 *  quel giorno è passato, e nessuno le ha chiuse. Compaiono in due posti:
 *   · /CRM/dafare  → «Rimasto indietro» (scritte a mano) e «Arretrato dei
 *     giorni scorsi» (i lead), vedi le fasce di crm/dafare/righe;
 *   · la scheda «Oggi» di /CRM/importa → «Promesse mancate» e «Dimenticate»,
 *     vedi crm/importa/scadenze.
 *  Quattro mucchi, due pagine, UNA idea sola: «che cosa non ho fatto». Il verso
 *  con cui si leggono sta quindi in un file solo, e le due pagine lo chiamano
 *  con le stesse parole. Due modi diversi di ordinare la stessa idea in due
 *  schermate dello stesso programma si imparano male e si sbagliano: si preme
 *  l'interruttore su una pagina, si passa all'altra, e l'elenco è al contrario
 *  senza che nessuno abbia toccato niente.
 *
 *  ── PERCHÉ SI PARTE DAI PIÙ VICINI A OGGI ─────────────────────────────────
 *  Perché è l'ordine in cui gli arretrati si RECUPERANO, e recuperarli è
 *  l'unica ragione per cui si guarda un elenco di ritardi.
 *  Una promessa mancata ieri si rimette a posto con una telefonata: la persona
 *  si ricorda di aver lasciato il numero, si ricorda della chiamata, e un
 *  «scusi, ieri non sono riuscito a richiamarla» funziona. La stessa promessa
 *  di tre settimane fa è una chiamata a freddo con una scusa attaccata: costa
 *  uguale e rende molto meno. Il valore di una riga arretrata cala col passare
 *  dei giorni, quindi in cima va quella che vale ancora.
 *  E c'è un secondo motivo, che è di forma: ordinando dal più vecchio, la testa
 *  dell'elenco è occupata SEMPRE dalle stesse righe — quelle di quaranta giorni
 *  fa, che nessuno chiamerà mai e che quindi non si muovono. Una lista la cui
 *  prima riga è la stessa ogni mattina smette di essere letta. Partendo dai più
 *  vicini, la testa cambia tutti i giorni, ed è fatta di cose ancora vive.
 *
 *  ⚠️ IL REPOSITORY AVEVA GIÀ DECISO IL CONTRARIO, ALTROVE, E VA BENE COSÌ.
 *   `ordinaGiornate` in crm/priorita.ts ordina le giornate delle installazioni
 *   DALLA PIÙ VECCHIA, e nel suo commento c'è scritta per esteso la ragione che
 *   qui si usa al rovescio («quella di ieri si recupera con una telefonata,
 *   quella di sei mesi fa è archeologia») insieme al prezzo di quella scelta:
 *   «la posa più vecchia rimasta aperta si pianta in testa alla pagina e ci
 *   resta finché qualcuno non la chiude». Là quel prezzo è il ricavo: una posa
 *   aperta da sei mesi è un cliente che ha PAGATO e aspetta, e piantarla in
 *   cima finché non si chiude è precisamente il comportamento voluto. Qui no:
 *   una promessa mancata da sei mesi è un contatto freddo, non un credito, e
 *   piantarla in cima costa la giornata di oggi.
 *   Due pagine, due domande, due difetti — non due dimenticanze.
 *
 *  ── E QUANDO SERVE L'ALTRO VERSO ──────────────────────────────────────────
 *  Quando non si sta recuperando, si sta FACENDO PULIZIA. È la mezz'ora che
 *  ogni tanto si dedica al mucchio: non per richiamare, ma per decidere chi non
 *  si richiama più — dargli un esito, ridargli una data lontana, chiudere la
 *  pratica. Lì la domanda cambia («chi sta lì da troppo?») ed è la domanda a
 *  cui rispondono, con lo stesso ordine, la scheda dei saltati
 *  (`ordinaSaltati`, crm/importa/saltati) e il conto di `SCADUTA_DA_TROPPO`.
 *  Serve anche per rendere conto a fine mese: il più vecchio è quello che spiega
 *  da quanto la falla è aperta.
 *  Sono due lavori diversi nella stessa giornata, quindi il verso è un comando
 *  e non una costante: sceglierne uno solo vorrebbe dire fare male l'altro.
 *
 *  ── PERCHÉ È UNA PAROLA E NON UNA FRECCIA ─────────────────────────────────
 *  Una freccia che cambia verso dice che QUALCOSA è cambiato, non CHE COSA: per
 *  saperlo bisogna leggere la prima riga, poi l'ultima, e ricostruire la regola
 *  a mente ogni volta che si apre la pagina. E un pulsante solo con su scritto
 *  un ordine è ancora peggio, perché non si sa mai se la scritta è lo stato
 *  («stai vedendo così») o il comando («premi per averlo così»).
 *  Perciò sono DUE pillole affiancate, sempre tutte e due leggibili: quella
 *  accesa è l'ordine attivo, quella spenta è l'alternativa. Si legge senza
 *  premere niente, che è la richiesta.
 *
 *  ── DOVE RESTA SCRITTO, E PERCHÉ NON IN ARCHIVIO ──────────────────────────
 *  Nel browser (`localStorage`), come la vista a colonne della pipeline e le
 *  preferenze delle notifiche.
 *  ⚠️ Non è in contraddizione con crm/importa/saltati, che il localStorage lo
 *   ha rifiutato a chiare lettere: là si salvava un FATTO sulla persona («è
 *   stato messo da parte»), e un fatto deve vederlo anche il collega dall'altra
 *   postazione, altrimenti la richiama lui. Qui si salva il verso con cui UNO
 *   guarda un elenco. Se finisse in archivio, il collega che sta recuperando i
 *   richiami si vedrebbe ribaltare la lista sotto le mani perché qualcun altro,
 *   in un'altra stanza, ha deciso di fare pulizia. È una preferenza dell'occhio,
 *   non un dato del centro: sta dove sta l'occhio.
 *  Una chiave sola per tutte e due le pagine, di proposito: chi gira l'ordine
 *  nella coda del setter lo ritrova girato in «Da fare oggi», perché è lo stesso
 *  mucchio guardato da due finestre e sta facendo lo stesso lavoro.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pillola } from "@/crm/ui/Finestra";
import { ordinaRighe, type RigaDaFare } from "./righe";

/** I due versi. I nomi dicono CHI STA IN CIMA, non «crescente/decrescente»:
 *  su una colonna di date passate «crescente» è un indovinello. */
export type VersoArretrati = "vicini" | "vecchi";

export const VERSO_DIFETTO: VersoArretrati = "vicini";

/** ⚠️ LE PAROLE STANNO QUI, UNA VOLTA SOLA. Sono la parte del lavoro che si
 *  rompe per prima: basta che una pagina scriva «Prima i recenti» e l'altra
 *  «Dal più nuovo» perché diventino due comandi diversi agli occhi di chi le
 *  usa tutte e due, anche se fanno esattamente la stessa cosa.
 *  «Vicini a oggi» e non «recenti» perché la data di cui si parla è quella per
 *  cui la cosa era DOVUTA, non quella in cui è stata scritta: «recente» si
 *  legge come «aggiunto da poco», che qui sarebbe un altro ordine ancora. */
export const PAROLA_VERSO: Record<VersoArretrati, string> = {
  vicini: "Prima i più vicini a oggi",
  vecchi: "Prima i più vecchi",
};

/** La spiegazione a comparsa: il nome corto basta a chi lavora, non a chi
 *  impara — è la stessa regola dei `titolo` di `Segmento` in crm/ui. */
export const PERCHE_VERSO: Record<VersoArretrati, string> = {
  vicini:
    "In cima quello che si recupera ancora con una telefonata: di ieri o dell'altro ieri il cliente si ricorda, di tre settimane fa no. È l'ordine per lavorare l'arretrato.",
  vecchi:
    "In cima chi è fermo da più tempo. È l'ordine per fare pulizia: non per richiamare, ma per decidere chi non si richiama più e dargli un esito.",
};

/** Quante righe deve avere un mucchio perché il comando dell'ordine abbia senso:
 *  sotto due, girarlo non muove niente e il pulsante sta lì solo a separare chi
 *  legge dal lavoro.
 *  ⚠️ STA QUI e non nelle due pagine, dov'era scritto due volte con lo stesso
 *   valore. Le parole, il verso e il difetto vivono già in questo file per la
 *   ragione detta in cima — due copie divergono al primo ritocco — e una soglia
 *   copiata è una copia come le altre: basta alzarla a tre da una parte perché
 *   la stessa fascia da due righe mostri il comando in una pagina e non
 *   nell'altra. */
export const MINIMO_PER_ORDINARE = 2;

const CHIAVE = "crm-arretrati-verso";

/** Il verso cambia in un punto e va letto in tre: la pagina che ordina e le due
 *  pillole disegnate in testa ai due mucchi. `localStorage` da solo non
 *  avvisa nessuno — l'evento `storage` del browser arriva solo alle ALTRE
 *  schede — quindi si batte un colpo a mano, come fa `scriviPrefs` in
 *  crm/notifications/prefs-browser. Senza, si preme la pillola sopra
 *  «Rimasto indietro» e quella sopra «Arretrato» resta accesa sull'altro verso:
 *  due comandi che dicono due cose e un solo ordine a schermo. */
const EVENTO = "crm-arretrati-verso";

export function leggiVerso(): VersoArretrati {
  //  Durante il render sul server `localStorage` non esiste: senza questa
  //  guardia la pagina non arriva nemmeno al browser.
  if (typeof window === "undefined") return VERSO_DIFETTO;
  try {
    return window.localStorage.getItem(CHIAVE) === "vecchi" ? "vecchi" : VERSO_DIFETTO;
  } catch {
    //  Navigazione privata o storage negato: si lavora lo stesso, col difetto.
    return VERSO_DIFETTO;
  }
}

export function scriviVerso(v: VersoArretrati): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHIAVE, v);
  } catch {
    /* quota piena o storage negato: il verso resta quello di questa sessione */
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/** Il verso come stato React, uguale in ogni punto dello schermo che lo legge. */
export function useVersoArretrati(): [VersoArretrati, (v: VersoArretrati) => void] {
  const [verso, setVerso] = useState<VersoArretrati>(VERSO_DIFETTO);

  //  ⚠️ Si parte dal DIFETTO e si rilegge al mount, invece di leggere subito
  //   dentro `useState`: queste pagine sono servite dal server, e un primo
  //   render che dice «vecchi» mentre il server ha disegnato «vicini» è
  //   un'idratazione che non combacia — cioè, in questo progetto, la schermata
  //   bianca. Il secondo render mostra il valore vero, e succede prima che
  //   l'occhio arrivi sull'elenco.
  useEffect(() => {
    const aggiorna = () => setVerso(leggiVerso());
    aggiorna();
    window.addEventListener(EVENTO, aggiorna);
    //  `storage` arriva dalle altre schede del browser: chi tiene la coda e
    //  «Da fare oggi» aperte in due schede non deve trovarle discordi.
    window.addEventListener("storage", aggiorna);
    return () => {
      window.removeEventListener(EVENTO, aggiorna);
      window.removeEventListener("storage", aggiorna);
    };
  }, []);

  const cambia = useCallback((v: VersoArretrati) => {
    setVerso(v);
    scriviVerso(v);
  }, []);

  return [verso, cambia];
}

/** ── L'ORDINE, APPLICATO ───────────────────────────────────────────────────
 *  Si parte SEMPRE da `ordinaRighe`, che è l'ordine del motore condiviso
 *  (spuntate in fondo, giorno crescente, poi l'orologio, poi il nome), e si
 *  rovescia UNA COSA SOLA: il giorno.
 *  Non si fa un `.reverse()` dell'elenco già ordinato, e la differenza non è
 *  teorica: rovesciando tutto finirebbero in cima le righe già spuntate, e
 *  dentro la stessa giornata le 17:00 verrebbero prima delle 9:00. Il verso
 *  parla di GIORNI — è la distanza da oggi che decide se una cosa si recupera —
 *  mentre dentro una giornata l'ordine dell'orologio è giusto in tutti e due i
 *  casi: si rifà la mattina prima del pomeriggio comunque.
 *  `sort` è stabile (lo garantisce il linguaggio), quindi restituire 0 a parità
 *  di giorno conserva esattamente l'ordine deciso da `ordinaRighe`: non si
 *  ricopia qui il confronto su ora e nome, che è il modo in cui due elenchi
 *  della stessa cosa cominciano a differire. */
export function ordinaArretrati(righe: RigaDaFare[], verso: VersoArretrati): RigaDaFare[] {
  const base = ordinaRighe(righe);
  if (verso === "vecchi") return base;
  return [...base].sort((a, b) => {
    //  Le spuntate restano in fondo in tutti e due i versi: una cosa fatta non
    //  è arretrato, e vederla in cima farebbe dubitare di tutte le altre.
    if (a.fatta !== b.fatta) return a.fatta ? 1 : -1;
    if (a.giorno !== b.giorno) return a.giorno < b.giorno ? 1 : -1;
    return 0;
  });
}

/** ── IL COMANDO ────────────────────────────────────────────────────────────
 *  Una striscia sottile in testa al mucchio che governa — non in cima alla
 *  pagina. Un comando che sta lontano da quello che cambia sembra valere per
 *  tutto lo schermo, e qui NON vale per tutto lo schermo: «Adesso» e
 *  «Stamattina» restano in ordine di orologio, perché una giornata si legge
 *  dall'inizio alla fine e non c'è niente da rovesciare.
 *
 *  ⚠️ Si disegna una volta per ogni mucchio arretrato, e le due copie dicono
 *   sempre la stessa cosa perché leggono lo stesso verso (vedi `EVENTO` qui
 *   sopra). Non è una svista: il mucchio che si vuole girare è quello che si sta
 *   guardando, e mandare a cercare l'interruttore in cima alla pagina dopo
 *   trenta righe di scorrimento vuol dire non girarlo mai.
 *   La spiegazione a comparsa dice che il verso vale anche per l'altro mucchio e
 *   per l'altra pagina, così la seconda pillola che si muove da sola non è una
 *   sorpresa. */
export function ScambiaVerso({ className }: { className?: string }) {
  const [verso, cambia] = useVersoArretrati();
  return (
    <div
      role="group"
      aria-label="Ordine dell'arretrato"
      className={cn(
        "flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-1.5",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowDownUp className="h-3.5 w-3.5" />
        ordine
      </span>
      {(["vicini", "vecchi"] as VersoArretrati[]).map((v) => (
        <Pillola
          key={v}
          attiva={verso === v}
          onClick={() => cambia(v)}
          titolo={`${PERCHE_VERSO[v]} · Vale per tutto l'arretrato, anche nell'altra scheda e nell'altra pagina, e resta così domani.`}
        >
          {PAROLA_VERSO[v]}
        </Pillola>
      ))}
    </div>
  );
}
