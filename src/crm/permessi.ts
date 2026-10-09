/** ── CHI PUÒ FARE CHE COSA ─────────────────────────────────────────────────
 *
 *  QUESTO FILE È SOLO IL MODELLO. Non legge il database, non conosce le rotte,
 *  non importa React: è la stessa tabella di verità per il browser e per il
 *  server, e vive in un file solo perché due copie si sarebbero disallineate
 *  alla prima aggiunta. Il browser la usa per NASCONDERE, il server per
 *  RIFIUTARE — e solo la seconda è una difesa.
 *
 *  ╔═══════════════════════════════════════════════════════════════════════╗
 *  ║  ── CHI COMANDA: I MESTIERI. IL LIVELLO È IL RIPIEGO. ───────────────  ║
 *  ╚═══════════════════════════════════════════════════════════════════════╝
 *  Il committente chiede una cosa sola: «assegno PIÙ ruoli insieme, e in base
 *  ai ruoli la persona ha accesso a quello che le serve; se la voglio admin ha
 *  tutto». I ruoli che si sommano esistono già in questo CRM e si chiamano
 *  MESTIERI (crm/kpi-setter.ts: setter, consulente, installatore,
 *  accompagnatore, driver, manutentore): sono spunte indipendenti, se ne
 *  accendono quante se ne vuole. Il LIVELLO invece è sempre stato uno solo per
 *  persona.
 *
 *  Tenere due elenchi di ruoli e farli decidere insieme è il modo sicuro di
 *  avere due schermate che rispondono in modo diverso alla stessa domanda.
 *  Quindi si sceglie, e la scelta è scritta qui:
 *
 *    · il PERMESSO è l'UNIONE di ciò che serve a ciascun mestiere ACCESO,
 *      più le eccezioni decise a mano (`extra`);
 *    · il LIVELLO conserva UNA cosa sola: le chiavi di casa. `admin` = tutto.
 *      Gli altri due valori (`consulente`, `setter`) non decidono più niente
 *      per chi è passato ai mestieri: restano scritti nelle righe vecchie, e
 *      sono il RIPIEGO qui sotto.
 *
 *  ── ⚠️ IL RIPIEGO, CIOÈ LA PARTE PIÙ IMPORTANTE DI TUTTO IL FILE ──────────
 *  Chi lavora oggi ha un livello e può non avere nessun mestiere acceso. Se il
 *  calcolo nuovo partisse da zero mestieri, domattina mezza azienda entrerebbe
 *  in un CRM che non fa niente. E il verso opposto è peggio: il valore di
 *  partenza dei mestieri è «consulente sì» (kpi-setter.ts), quindi calcolare i
 *  permessi dai mestieri di una riga che non li ha mai scritti regalerebbe
 *  preventivi e incassi a ogni setter dell'archivio.
 *
 *  Per questo il passaggio NON avviene a data di rilascio ma UNA RIGA PER
 *  VOLTA, e lo decide una persona: nella colonna dei permessi si scrive
 *  `daMestieri: true` quando qualcuno salva quella scheda dalla sezione
 *  «Accesso → Cosa può fare», che prima di salvare mostra in chiaro che cosa
 *  quella persona potrà fare e che cosa perde. Finché quel segno non c'è,
 *  comanda il livello ESATTAMENTE come prima: nessuno guadagna un permesso,
 *  nessuno lo perde, nessuno resta chiuso fuori. È lo stesso modo con cui
 *  questo file tratta già i nomi vecchi (`EREDITA_STORICA`): si legge quello
 *  che c'è, e si cambia quando qualcuno decide, non quando si aggiorna il
 *  programma.
 *
 *  ── ⚠️ E NESSUN MESTIERE CONSEGNA LE CHIAVI ──────────────────────────────
 *  `PERMESSI_MESTIERE` qui sotto non contiene — e non deve mai contenere —
 *  `consulenti`, `impostazioni`, `listino`, `archivio`. Non è un dettaglio di
 *  gusto: i mestieri stanno in `crm_consultants.data`, che il browser scrive
 *  direttamente, mentre il livello sta in `consultant_pins.permissions`, che si
 *  scrive solo passando dalla rotta guardata. Grazie a questa regola la domanda
 *  «chi può assegnare PIN e permessi?» dà la stessa risposta con o senza i
 *  mestieri sotto mano — ed è la ragione per cui la protezione contro l'ultima
 *  porta chiusa dall'interno (`altriConLeChiavi`) non ha dovuto cambiare di una
 *  riga.
 *
 *  ── ⚠️ E IL PREZZO DI QUESTA SCELTA, DETTO PER INTERO ─────────────────────
 *  «Il browser scrive i mestieri» non è un modo di dire: `crm_consultants` è
 *  aperta in scrittura a `auth.uid() = user_id` (migrazione 20260419145616), e
 *  chi entra col PIN ha in mano proprio la sessione del proprietario — è l'unico
 *  modo perché le regole di riga lo lascino leggere (vedi la testata di
 *  routes/api.crm.accesso.ts). Quindi una persona GIÀ PASSATA ai mestieri, se
 *  sa usare gli strumenti del browser, può riscrivere la propria riga e
 *  regalarsi ciò che i mestieri danno: `agenda`, `preventivi`, `pagamenti`,
 *  `installazioni`. Non le chiavi — quelle stanno nell'altra tabella, e questa
 *  è tutta la differenza — ma nemmeno niente.
 *  Prima di questa riscrittura non era possibile: i permessi stavano SOLO in
 *  `consultant_pins.permissions`, che si scrive passando dalla rotta guardata.
 *  Il buco si chiude in un posto solo, e non è questo file: o le regole di riga
 *  di `crm_consultants` smettono di accettare l'aggiornamento delle spunte dal
 *  browser (e allora i mestieri si salvano dalla rotta, che il service role ce
 *  l'ha già), oppure le spunte si spostano accanto al PIN. Finché una delle due
 *  cose non è fatta, questo è il perimetro reale: da qui in giù si può salire da
 *  soli, da qui in su no. Scritto perché si veda, non perché vada bene.
 *
 *  ── PERCHÉ TRE LIVELLI E NON VENTI CASELLE ────────────────────────────────
 *  Un pannello con venti interruttori non viene configurato: si lascia il
 *  preimpostato, e il preimpostato diventa l'unico permesso che esiste davvero.
 *  Si spuntano i MESTIERI — che è l'unica cosa che chi assegna il PIN sa già
 *  senza doverci pensare — e poi si accende o si spegne QUALCHE cosa, quelle
 *  poche che in un'azienda cambiano davvero da persona a persona (chi può
 *  cancellare, chi vede i lead di tutti, chi tocca gli incassi).
 *
 *  I tre livelli qui sotto restano perché le righe scritte prima di oggi li
 *  dicono, e perché ADMIN è ancora il modo di consegnare tutto in un gesto.
 *
 *    · SETTER      sta al telefono. Lavora la lista che gli viene data, chiama,
 *                  segna gli esiti e FISSA gli appuntamenti. Non fa consulenze,
 *                  non fa preventivi, non tocca soldi. È il livello più basso,
 *                  ed è anche il ripiego di ogni dato che non si riesce a
 *                  leggere: un permesso non scritto vuol dire NO, mai SÌ.
 *    · CONSULENTE  fa le videoconsulenze e i preventivi, incassa gli anticipi,
 *                  lavora i PROPRI lead. È il setter più il mestiere della
 *                  consulenza — e sono esattamente i permessi che il livello
 *                  "consulente" aveva prima di questa riscrittura.
 *    · ADMIN       vede e gestisce tutto: archivio, listino, spesa pubblicitaria
 *                  e margini, PIN e permessi. È il "super admin", cioè le
 *                  chiavi di casa. Prendeva il posto di "titolare".
 *
 *  ── IL PERMESSO STA CON LA CHIAVE ─────────────────────────────────────────
 *  Il livello si assegna nella scheda del consulente, accanto al PIN: sono la
 *  stessa decisione ("questa persona entra, e fa queste cose") e separarle
 *  significherebbe assegnare il PIN oggi e i permessi mai. Viaggia insieme al
 *  PIN anche in Meetly, perché il PIN è lo stesso.
 *
 *  ── COMPATIBILITÀ CON QUELLO CHE C'ERA ────────────────────────────────────
 *  Prima esistevano sette interruttori inglesi (canChangeStatus, canDeleteLead,
 *  …) salvati nella stessa colonna `consultant_pins.permissions`. Restano validi
 *  e continuano a comandare.
 *
 *  ⚠️ E NELLA STESSA COLONNA C'È ANCHE IL SEGNO DEL PASSAGGIO: `daMestieri`.
 *  Presente e vero = questa persona è già passata al calcolo per mestieri.
 *  Assente = comanda il livello, come ha sempre fatto. Vedi la testata.
 *
 *  ⚠️ E NELLA STESSA COLONNA CI SONO ANCORA I NOMI VECCHI. Le righe scritte
 *  prima di oggi dicono "titolare", "responsabile", "consulente", e alcune non
 *  dicono niente. Nessuna di queste righe viene riscritta nel database: la
 *  traduzione avviene in LETTURA, qui sotto (`ruoloDaScritta`), e la riga si
 *  aggiorna da sola la prima volta che qualcuno salva quella scheda. Tradurre
 *  leggendo è l'unico modo di non dipendere da una migrazione che nessuno può
 *  provare due volte.
 *  ───────────────────────────────────────────────────────────────────────── */
import { DEFAULT_PERMISSIONS, type ConsultantData, type ConsultantPermissions } from "@/crm/types";
//  ⚠️ L'UNICO LETTORE DEI MESTIERI, ED È QUELLO CHE C'ERA GIÀ. `mestieriDi` sa
//  leggere i campi storti che arrivano dal JSONB ("1", "true", null) e conosce
//  il nome vecchio dell'installatore: rileggere qui quelle spunte a mano
//  avrebbe prodotto il secondo elenco di mestieri di questo CRM, cioè
//  esattamente quello che tutti i commenti di kpi-setter.ts chiedono di non
//  fare. La dipendenza va in un verso solo — permessi legge i mestieri, i
//  mestieri non sanno niente dei permessi — quindi non c'è nessun cerchio.
import { mestieriDi, type Mestieri } from "@/crm/kpi-setter";

// ── I LIVELLI ───────────────────────────────────────────────────────────────

/** ⚠️ I MESTIERI NON SI AGGIUNGONO QUI SOTTO, E ADESSO MENO CHE MAI.
 *  Chi telefona, chi fa consulenze, chi va a posare, chi affianca, chi guida e
 *  chi fa tornare l'impianto
 *  stanno in crm/kpi-setter.ts e si SOMMANO: si può essere driver e consulente
 *  insieme, o driver e basta. Questi tre valori invece sono una SCALA, uno solo
 *  per persona, e da oggi ne resta in piedi uno solo che decida qualcosa —
 *  `admin`, le chiavi di casa. Aggiungere qui un quarto valore «driver»
 *  vorrebbe dire tornare a un elenco di ruoli che non si possono sommare, e
 *  obbligare a un quinto «driver+consulente» al primo caso reale.
 *  Chi cerca dove si accendono: scheda del consulente, «Accesso → Cosa può
 *  fare» (le stesse spunte compaiono anche nell'anagrafica: è lo stesso dato). */
export type RuoloCRM = "admin" | "consulente" | "setter";

/** ── LA SCALA DEI LIVELLI NON C'È PIÙ, E NON VA RIMESSA ────────────────────
 *  Qui stavano `RUOLI` (l'ordine in cui la scheda disegnava i tre livelli) e
 *  `DESCRIZIONE_RUOLO` (che cosa faceva ciascuno). Sono spariti insieme alla
 *  scala che disegnavano: adesso si accendono i mestieri, e le loro descrizioni
 *  stanno sulle spunte, dove si decide. Lasciarli qui — non letti da nessuno ma
 *  pronti da usare — avrebbe significato tenere in casa una seconda risposta
 *  alla domanda «che cosa può fare questa persona», scritta con le parole di
 *  ieri e destinata a non essere più aggiornata.
 *  Restano `ETICHETTA_RUOLO` e i tre valori, perché le righe vecchie li dicono
 *  ancora e la scheda deve poterli NOMINARE («segue ancora il livello
 *  Consulente»). */

/** IL RIPIEGO, IN UN POSTO SOLO. Livello mancante, illeggibile o scritto con un
 *  nome che non conosciamo: si vale questo, cioè il meno potente. Sta in una
 *  costante e non sparso fra i file perché è la decisione che, sbagliata,
 *  regala permessi a chi non li ha mai avuti. */
export const RUOLO_MINIMO: RuoloCRM = "setter";

/** ── LA BASE DI CHI NON HA ANCORA UN LIVELLO SCRITTO: VEDE TUTTO ────────────
 *  Richiesta del committente: «di default tutti i consulenti vedono tutto come
 *  base, poi posso cambiare autorizzazione dal setting consulenti».
 *  Vale SOLO quando il livello non c'è proprio (persona nuova, PIN appena
 *  dato, riga nata col valore di serie della colonna). Un livello scritto si
 *  rispetta com'è, e uno scritto ma illeggibile resta RUOLO_MINIMO: lì
 *  qualcuno ha deciso qualcosa, e non sappiamo cosa.
 *  Per restringere: Collaboratori → la persona → «Che cosa può fare» —
 *  spegnere ADMIN la passa ai mestieri, oppure si spengono le singole voci. */
export const RUOLO_DI_PARTENZA: RuoloCRM = "admin";

/** I permessi. Il nome dice la COSA, non la pagina: le pagine si spostano, il
 *  mestiere no. `lead.propri` è la base che ha chiunque entri. */
export type Permesso =
  | "lead.propri"
  | "lead.tutti"
  | "lead.crea"
  | "lead.elimina"
  | "lead.assegna"
  | "agenda"
  | "preventivi"
  | "pagamenti"
  | "listino"
  | "marketing"
  | "installazioni"
  | "archivio"
  | "consulenti"
  | "impostazioni"
  | "registrazioni.tutte";

export const TUTTI_I_PERMESSI: Permesso[] = [
  "lead.propri",
  "lead.tutti",
  "lead.crea",
  "lead.elimina",
  "lead.assegna",
  "agenda",
  "preventivi",
  "pagamenti",
  "listino",
  "marketing",
  "installazioni",
  "archivio",
  "consulenti",
  "impostazioni",
  "registrazioni.tutte",
];

/** Quello che si legge a schermo. Frasi, non sigle: chi assegna un permesso
 *  deve capire che cosa sta consegnando senza aprire il codice. */
export const ETICHETTA_PERMESSO: Record<Permesso, string> = {
  "lead.propri": "Lavorare i propri lead",
  "lead.tutti": "Vedere i lead di tutti",
  "lead.crea": "Creare nuovi lead",
  "lead.elimina": "Cancellare lead",
  "lead.assegna": "Assegnare i lead ai consulenti",
  agenda: "Agenda e appuntamenti",
  preventivi: "Fare preventivi",
  pagamenti: "Registrare incassi e anticipi",
  listino: "Cambiare listino, sconti e coupon",
  marketing: "Vedere spesa pubblicitaria e margini",
  installazioni: "Installazioni e spedizioni",
  archivio: "Esportare e importare l'archivio",
  consulenti: "Gestire consulenti, PIN e permessi",
  impostazioni: "Cambiare le impostazioni",
  "registrazioni.tutte": "Vedere le registrazioni di tutti",
};

/** La frase che compare quando un permesso manca: dice CHE COSA fare, non solo
 *  che è vietato. Un "accesso negato" senza rimedio genera una telefonata. */
export const MOTIVO_PERMESSO: Record<Permesso, string> = {
  "lead.propri": "Questa parte è riservata a chi lavora i lead.",
  "lead.tutti": "Vedi solo i lead assegnati a te.",
  "lead.crea": "I nuovi lead li inserisce chi gestisce le assegnazioni.",
  "lead.elimina": "Un lead lo cancella solo chi gestisce l'archivio.",
  "lead.assegna": "Le assegnazioni le decide un admin.",
  agenda: "L'agenda è riservata a chi fissa gli appuntamenti.",
  preventivi: "I preventivi li fa chi svolge le consulenze.",
  pagamenti: "Gli incassi li registra chi ne ha il permesso.",
  listino: "Listino e sconti li cambia solo un admin.",
  marketing: "Spesa pubblicitaria e margini sono riservati agli admin.",
  installazioni: "Le installazioni le gestisce chi si occupa della logistica.",
  archivio: "L'archivio lo esporta e lo importa solo un admin.",
  consulenti: "PIN e permessi li assegna solo un admin.",
  impostazioni: "Le impostazioni le cambia solo un admin.",
  "registrazioni.tutte": "Vedi solo le registrazioni delle tue consulenze.",
};

export const ETICHETTA_RUOLO: Record<RuoloCRM, string> = {
  admin: "Admin",
  consulente: "Consulente",
  setter: "Setter",
};

/** ── LA TABELLA DEI LIVELLI: ADESSO È IL RIPIEGO ───────────────────────────
 *  Sotto ogni livello c'è quello del livello inferiore: setter ⊂ consulente ⊂
 *  admin. Costruirla per somme evita la classica svista di dare a un livello
 *  alto meno cose di uno basso, e rende impossibile che «promuovere» qualcuno
 *  gli tolga qualcosa.
 *
 *  PERCHÉ PROPRIO QUESTA COMPOSIZIONE
 *  · il SETTER telefona e fissa: gli servono i propri contatti (`lead.propri`,
 *    che ha chiunque entri, altrimenti il CRM si apre e non fa niente) e
 *    l'agenda, che è il suo strumento di lavoro — «fissare» È scrivere in
 *    agenda. Non `preventivi` e non `pagamenti`: il committente li ha esclusi a
 *    voce, e sono anche le due cose che, sbagliate da chi non le fa di
 *    mestiere, si vedono in cassa;
 *  · il CONSULENTE aggiunge esattamente quelle due — `preventivi` e
 *    `pagamenti`. Il risultato è, permesso per permesso, il vecchio livello
 *    "consulente": chi lavorava ieri lavora identico domani, che è la sola
 *    prova che una riscrittura di permessi non ha rotto niente;
 *  · l'ADMIN ha tutto. Non ha un elenco suo proprio perché un elenco scritto a
 *    mano si dimentica di aggiornarlo: aggiungere un permesso nuovo deve
 *    arrivare all'admin da solo, il giorno stesso.
 *
 *  Il livello di mezzo di prima ("responsabile") non c'è più: le sue cose —
 *  vedere i lead di tutti, assegnarli, i numeri delle campagne, le
 *  installazioni — stanno adesso o dentro ADMIN, o negli interruttori fini qui
 *  sotto, che è il modo di darne una senza dare anche la cassaforte.
 *
 *  ⚠️ E DA OGGI QUESTA TABELLA DECIDE SOLO PER CHI NON È ANCORA PASSATO AI
 *  MESTIERI — cioè per tutti quelli che lavorano adesso, finché qualcuno non
 *  apre la loro scheda. Non è codice morto in attesa di essere cancellato: è la
 *  rete che tiene su l'azienda il giorno del rilascio, e va tolta solo quando
 *  nessuna riga del database dirà più un livello. */
/** ── ⚠️ IL SETTER FA IL MESTIERE DEL SETTER, PER INTERO ────────────────────
 *  Richiesta del committente: «fai che il setter può fare tutto quello che
 *  serve fare a un setter».
 *  Mancava `lead.crea`, e non era un dettaglio: il mestiere del setter È
 *  lavorare una lista, e la lista si carica da un file. Senza quel permesso la
 *  scheda «Importa lead» non gli compariva nemmeno — cioè l'unica persona a
 *  cui serve caricare i contatti era l'unica che non poteva farlo, e ogni
 *  mattina chiedeva a un admin di caricarglieli. Con lo stesso permesso può
 *  anche aggiungere a mano il contatto che arriva mentre è al telefono, che è
 *  la seconda cosa che gli capita tutti i giorni.
 *  ⚠️ NON GLI SI DÀ NIENT'ALTRO, e in particolare non `lead.tutti`: il setter
 *   lavora i PROPRI. E non `preventivi` né `pagamenti` — sono le due cose che,
 *   sbagliate da chi non le fa di mestiere, si vedono in cassa. */
const BASE_SETTER: Permesso[] = ["lead.propri", "lead.crea", "agenda"];

const BASE_CONSULENTE: Permesso[] = [...BASE_SETTER, "preventivi", "pagamenti"];

export const PERMESSI_RUOLO: Record<RuoloCRM, Permesso[]> = {
  setter: BASE_SETTER,
  consulente: BASE_CONSULENTE,
  admin: TUTTI_I_PERMESSI,
};

/** ── LA TABELLA CHE DECIDE DAVVERO, DA OGGI: UN MESTIERE, LE SUE COSE ──────
 *  Le due voci che si misurano riusano le stesse liste dei livelli qui sopra, e
 *  non una copia: chi «fa il setter» ha esattamente ciò che aveva il livello
 *  setter, chi «fa il consulente» esattamente ciò che aveva il livello
 *  consulente. È la sola prova che il passaggio non regala e non toglie niente
 *  a chi faceva un mestiere solo — e chi ne fa due adesso li ha tutti e due,
 *  che è precisamente quello che prima non si poteva dire.
 *
 *  I quattro mestieri di campo aprono UNA cosa: la pagina delle installazioni e
 *  delle spedizioni. Chi va a posare, chi affianca sul posto e chi porta devono
 *  poter leggere dove e quando: negarglielo significa mandarli a lavorare e poi
 *  dettargli l'indirizzo al telefono. Non aprono nient'altro, e in particolare
 *  non aprono l'agenda: la posa gliela programma qualcun altro.
 *  ⚠️ IL MANUTENTORE PRENDE LA STESSA IDENTICA COSA, e non è una scorciatoia:
 *  la lente delle manutenzioni e le manutenzioni del giorno VIVONO dentro quella
 *  pagina (crm/manutenzione/PannelloManutenzioni.tsx, montato da
 *  routes/CRM.installazioni.*), quindi «vedo i ritorni che devo fare» e «vedo le
 *  pose» sono di fatto lo stesso permesso. Dargliene uno nuovo tutto suo
 *  vorrebbe dire inventare un permesso che non chiude nessuna porta in più —
 *  cioè una spunta da assegnare che non protegge niente. Nemmeno a lui si apre
 *  l'agenda: il ritorno glielo fissa chi ha il cliente davanti.
 *
 *  ⚠️ QUI DENTRO NON ENTRANO MAI `consulenti`, `impostazioni`, `listino`,
 *  `archivio`. Vedi la testata: è la regola che tiene in piedi la protezione
 *  contro il CRM chiuso a chiave dall'interno, e che impedisce a una spunta
 *  scritta dal browser di diventare una promozione. */
const LAVORO_SUL_CAMPO: Permesso[] = ["lead.propri", "installazioni"];

export type ChiaveMestiere =
  | "faSetter"
  | "faConsulente"
  | "faInstallatore"
  | "faAccompagnatore"
  | "faDriver"
  | "faManutentore";

/** Nell'ordine del lavoro, lo stesso delle spunte a schermo: chi telefona, chi
 *  fa la consulenza, chi posa, chi affianca, chi porta, e in fondo chi fa
 *  tornare il cliente — il ritorno viene dopo tutto il resto. */
export const MESTIERI: ChiaveMestiere[] = [
  "faSetter",
  "faConsulente",
  "faInstallatore",
  "faAccompagnatore",
  "faDriver",
  "faManutentore",
];

export const PERMESSI_MESTIERE: Record<ChiaveMestiere, Permesso[]> = {
  faSetter: BASE_SETTER,
  faConsulente: BASE_CONSULENTE,
  faInstallatore: LAVORO_SUL_CAMPO,
  faAccompagnatore: LAVORO_SUL_CAMPO,
  faDriver: LAVORO_SUL_CAMPO,
  faManutentore: LAVORO_SUL_CAMPO,
};

/** Il nome del mestiere dentro una frase: «perché fa il consulente». Minuscolo
 *  e senza articolo, così si incastra dove serve senza doverlo ritagliare. */
export const NOME_MESTIERE: Record<ChiaveMestiere, string> = {
  faSetter: "setter",
  faConsulente: "consulente",
  faInstallatore: "installatore",
  faAccompagnatore: "accompagnatore",
  faDriver: "driver",
  faManutentore: "manutentore",
};

/** Quali mestieri sono accesi, nell'ordine di `MESTIERI`. */
export function mestieriAccesi(m: Mestieri): ChiaveMestiere[] {
  return MESTIERI.filter((k) => m[k] === true);
}

/** ── L'UNIONE ──────────────────────────────────────────────────────────────
 *  Tutto ciò che serve a ciascun mestiere acceso, messo insieme. Nessuna
 *  gerarchia e nessuna sottrazione: due mestieri danno la somma delle loro
 *  cose, e spegnere il secondo lascia in piedi il primo.
 *  `lead.propri` c'è comunque, anche senza nessun mestiere: chi entra deve
 *  almeno vedere le proprie schede, o il CRM si apre e non fa niente. */
export function permessiDeiMestieri(m: Mestieri): Permesso[] {
  const dentro = new Set<Permesso>(["lead.propri"]);
  for (const k of mestieriAccesi(m)) for (const p of PERMESSI_MESTIERE[k]) dentro.add(p);
  return TUTTI_I_PERMESSI.filter((p) => dentro.has(p));
}

/** ── GLI INTERRUTTORI DELLA SCHEDA ─────────────────────────────────────────
 *  Non tutti e quindici: sono il kit del livello di mezzo scomparso — vedere i
 *  lead di tutti, assegnarli, crearli, le installazioni, i numeri delle
 *  campagne, le registrazioni dei colleghi — più le due cose che in un'azienda
 *  vera cambiano davvero da persona a persona: cancellare un lead e toccare i
 *  soldi. Messi insieme ricostruiscono un ex "responsabile" senza dargli le
 *  chiavi, ed è il motivo per cui il livello di mezzo può sparire senza che
 *  nessuno resti scoperto.
 *
 *  NON sono interruttori — e non è una dimenticanza — `listino`, `archivio`,
 *  `consulenti` e `impostazioni`: sono la cassaforte, si danno tutte insieme
 *  con ADMIN o non si danno. Mezza chiave è il modo in cui nasce qualcuno che
 *  può cambiare i prezzi ma non sa dove si vede il margine.
 *  Fuori restano anche `lead.propri`, `agenda` e `preventivi`: quelli li dà il
 *  MESTIERE, e si spengono spegnendo il mestiere. Metterli anche qui vorrebbe
 *  dire poter avere un consulente senza preventivi — cioè una persona che a
 *  schermo fa un mestiere e nel CRM ne fa un altro. */
export const INTERRUTTORI_FINI: Permesso[] = [
  "lead.tutti",
  "lead.assegna",
  "lead.crea",
  "lead.elimina",
  "pagamenti",
  "installazioni",
  "marketing",
  "registrazioni.tutte",
];

// ── COME È SALVATO ──────────────────────────────────────────────────────────

/** Il contenuto della colonna `consultant_pins.permissions`. I campi inglesi
 *  sono quelli storici e restano: `Partial` perché una riga vecchia può averne
 *  solo alcuni, e una riga nuova nessuno. */
export interface PermessiConsulente extends Partial<ConsultantPermissions> {
  ruolo?: RuoloCRM;
  /** Deroghe: `true` concede, `false` toglie. Solo ciò che è stato toccato
   *  davvero compare qui — l'assenza significa "come dice la base", non "no".
   *  ⚠️ La BASE da cui si discostano non è sempre la stessa: è l'unione dei
   *  mestieri per le righe passate, il livello per quelle vecchie. Si scrivono
   *  sempre con `daSalvare`, che la base la conosce. */
  extra?: Partial<Record<Permesso, boolean>>;
  /** ── IL SEGNO DEL PASSAGGIO ──────────────────────────────────────────────
   *  `true` = i permessi di questa persona si calcolano dai MESTIERI accesi.
   *  Assente = comanda ancora il livello, esattamente come prima che i mestieri
   *  decidessero qualcosa.
   *  Lo scrive la scheda del consulente quando qualcuno salva quella sezione,
   *  cioè quando una PERSONA decide — mai un aggiornamento del programma, mai
   *  una migrazione. È tutta la protezione contro il «domattina mezza azienda
   *  non entra più»: finché il segno non c'è, non cambia niente per nessuno. */
  daMestieri?: boolean;
}

/** Il risultato: la domanda "può?" con una risposta sola, più i vecchi campi
 *  inglesi già normalizzati per il codice che li usa ancora. */
export interface Accesso {
  ruolo: RuoloCRM;
  /** I permessi vengono dai MESTIERI (`true`) o ancora dal livello (`false`)?
   *  Non è un permesso e non decide niente: serve alla scheda per dire in
   *  chiaro quale delle due regole è in vigore su questa persona, invece di
   *  mostrare un elenco che nessuno sa da dove arriva. */
  secondoMestieri: boolean;
  /** Il livello era SCRITTO nella riga (anche con un nome vecchio), oppure è il
   *  ripiego? Serve alla scheda per dire «a questa persona non è mai stato
   *  assegnato un livello: vale il più basso» invece di far credere che
   *  qualcuno l'abbia scelto. Non è un permesso e non decide niente. */
  dichiarato: boolean;
  puo: (p: Permesso) => boolean;
  /** L'elenco disteso, per mostrarlo e per spedirlo. */
  elenco: Permesso[];
  /** Le deroghe, così la scheda sa quali interruttori disegnare accesi.
   *  ⚠️ Non sono solo quelle SCRITTE nella riga: qui dentro compare anche
   *  l'eredità di un nome vecchio («responsabile»), che nel database non è
   *  scritta da nessuna parte e senza questo non si vedrebbe — sparendo alla
   *  prima risalvata. Vedi `risolviAccesso`. */
  extra: Partial<Record<Permesso, boolean>>;
  /** I sette campi storici, da consegnare alle rotte che li leggono ancora. */
  legacy: ConsultantPermissions;
}

/** ── I NOMI VECCHI, E DOVE FINISCONO ───────────────────────────────────────
 *  Nel database ci sono ancora righe scritte con il vocabolario di prima.
 *  Questa è la traduzione, e vale sia in lettura sia per le rotte che ricevono
 *  un livello dalla rete (un browser rimasto aperto da ieri manda ancora i nomi
 *  vecchi):
 *
 *    titolare     → admin        stessa cosa con un altro nome: tutto.
 *    consulente   → consulente   il nome non cambia e nemmeno i permessi.
 *    responsabile → consulente   ⚠️ e va spiegato, perché è l'unica scelta che
 *                                toglie qualcosa a qualcuno.
 *
 *  «Responsabile» non ha più un posto suo. Le due strade erano alzarlo ad ADMIN
 *  o abbassarlo a CONSULENTE, e sono asimmetriche:
 *   · alzarlo gli consegnerebbe listino, archivio, PIN e permessi — cioè
 *     esattamente le tre cose che nel vecchio modello gli erano negate per
 *     iscritto («quelle tre cose sono la cassaforte»). Sarebbe una promozione
 *     silenziosa, decisa da una riscrittura e non da chi comanda, e chi la
 *     riceve può poi togliere i permessi a tutti gli altri: non si torna
 *     indietro da soli;
 *   · abbassarlo è visibile il primo giorno, si dice a voce, e si rimedia in un
 *     gesto dalla scheda («Dai pieno controllo», o gli interruttori fini).
 *  Fra un errore che si vede e uno che non si vede si sceglie quello che si
 *  vede. PERÒ non gli si toglie niente per sorpresa: qui sotto le sue vecchie
 *  facoltà restano attaccate alla riga (`EREDITA_STORICA`) finché quella scheda
 *  non viene risalvata, e nella scheda compaiono come deroghe accese, dove si
 *  leggono e si spengono una per una. */
const NOMI_VECCHI: Record<string, RuoloCRM> = {
  titolare: "admin",
  responsabile: "consulente",
  consulente: "consulente",
};

/** Quello che il vecchio "responsabile" poteva fare e che il CONSULENTE di oggi
 *  non fa. Non è un livello: è la memoria di una riga scritta ieri, e sopravvive
 *  solo finché quella riga non viene salvata di nuovo (allora diventano deroghe
 *  vere e proprie, scritte a chiare lettere). */
const EREDITA_RESPONSABILE: Permesso[] = [
  "lead.tutti",
  "lead.crea",
  "lead.assegna",
  "marketing",
  "installazioni",
  "registrazioni.tutte",
];

const EREDITA_STORICA: Record<string, Permesso[]> = {
  responsabile: EREDITA_RESPONSABILE,
};

/** Da qualunque cosa sia scritta al livello di oggi. `null` = non è un livello
 *  che conosciamo, e chi chiama decide cosa farne (in lettura: RUOLO_MINIMO;
 *  in scrittura: non si tocca quello che c'è già). */
export function ruoloDaScritta(v: unknown): RuoloCRM | null {
  if (v === "admin" || v === "consulente" || v === "setter") return v;
  if (typeof v !== "string") return null;
  return NOMI_VECCHI[v] ?? null;
}

/** Le tre bandiere storiche che sono davvero un permesso, e non un dettaglio
 *  di come si lavora un lead: se una riga vecchia le dichiara, comandano loro. */
const DA_LEGACY: { campo: keyof ConsultantPermissions; permesso: Permesso }[] = [
  { campo: "canDeleteLead", permesso: "lead.elimina" },
  { campo: "canAddLead", permesso: "lead.crea" },
  { campo: "canChangePayment", permesso: "pagamenti" },
];

/** ── LA BASE, PRIMA DELLE DEROGHE ──────────────────────────────────────────
 *  Un posto solo in cui è scritto da dove si parte, perché la stessa domanda la
 *  fanno tre schermate e due rotte: la scheda che disegna gli interruttori, il
 *  salvataggio che calcola le deroghe, e la lettura qui sotto. Se il conto
 *  stesse in tre punti, il giorno in cui un mestiere cambia contenuto la scheda
 *  mostrerebbe una cosa e il server ne applicherebbe un'altra.
 *
 *  `mestieri === null` vuol dire «questa riga non è passata ai mestieri, oppure
 *  i mestieri non li ho sotto mano»: si vale il livello, che è il modo in cui
 *  ha sempre funzionato. */
export function permessiDiPartenza(ruolo: RuoloCRM, mestieri: Mestieri | null): Permesso[] {
  //  ADMIN prima di tutto: le chiavi di casa non passano dai mestieri, e un
  //  admin che non fa nessun mestiere resta un admin.
  if (ruolo === "admin") return TUTTI_I_PERMESSI;
  if (mestieri) return permessiDeiMestieri(mestieri);
  return PERMESSI_RUOLO[ruolo];
}

/** Base più le deroghe, nell'ordine di `TUTTI_I_PERMESSI`. La scheda la usa per
 *  disegnare l'elenco «ecco che cosa potrà fare» mentre si toccano le spunte,
 *  senza chiedere niente al server e senza rifare il ragionamento a modo suo. */
export function conDeroghe(
  base: Permesso[],
  deroghe: Partial<Record<Permesso, boolean>>,
): Permesso[] {
  const dentro = new Set<Permesso>(base);
  for (const k of TUTTI_I_PERMESSI) {
    const v = deroghe[k];
    if (v === true) dentro.add(k);
    else if (v === false) dentro.delete(k);
  }
  //  Come nella lettura: chi entra vede almeno le proprie schede.
  dentro.add("lead.propri");
  return TUTTI_I_PERMESSI.filter((p) => dentro.has(p));
}

/** ── DA QUELLO CHE C'È NEL DATABASE A UNA RISPOSTA SÌ/NO ───────────────────
 *  Il grezzo arriva da una colonna jsonb: può essere null, può essere una
 *  stringa, può essere un oggetto con campi che non ci aspettiamo. Nessun campo
 *  viene dato per buono, e il ripiego è sempre il livello più basso — un
 *  permesso concesso per errore di lettura è il modo peggiore di sbagliare.
 *
 *  ── ⚠️ IL SECONDO ARGOMENTO NON È FACOLTATIVO PER COMODITÀ ────────────────
 *  `datiConsulente` è la riga `crm_consultants.data` della persona, cioè dove
 *  stanno le spunte dei mestieri. Chi la ha sotto mano DEVE passarla: senza,
 *  una riga già passata ai mestieri viene risolta col suo livello — che in
 *  quella modalità è il minimo, o `admin` — e la persona si ritrova con meno di
 *  quello che le spetta. È il verso giusto in cui sbagliare (si vede subito e
 *  non apre niente a nessuno), ma resta uno sbaglio: le rotte che leggono i
 *  permessi leggono già quella riga per sapere nome e se è attiva, quindi non
 *  costa nemmeno una query in più.
 *  ⚠️ NON si legge qui il ripiego dei mestieri: `undefined` significa «non lo
 *  so», e trattarlo come «consulente sì» (il valore di partenza di kpi-setter)
 *  regalerebbe preventivi e incassi a chi non li ha mai avuti. */
export function risolviAccesso(grezzo: unknown, datiConsulente?: unknown): Accesso {
  let p: PermessiConsulente = {};
  if (typeof grezzo === "string") {
    try {
      p = JSON.parse(grezzo) as PermessiConsulente;
    } catch {
      p = {};
    }
  } else if (grezzo && typeof grezzo === "object") {
    p = grezzo as PermessiConsulente;
  }

  //  Il livello grezzo si guarda una volta sola e in tre modi: che livello è
  //  oggi, se era davvero scritto, e che cosa dava ieri quel nome se era un nome
  //  vecchio. Un livello illeggibile vale RUOLO_MINIMO — non è il permesso di
  //  niente; un livello che MANCA vale RUOLO_DI_PARTENZA (vedi la sua nota).
  const scritta = typeof p.ruolo === "string" ? p.ruolo : "";
  const tradotto = ruoloDaScritta(scritta);
  const ruolo: RuoloCRM = tradotto ?? (scritta === "" ? RUOLO_DI_PARTENZA : RUOLO_MINIMO);
  const dichiarato = tradotto !== null;

  //  ── QUALE DELLE DUE REGOLE VALE SU QUESTA RIGA ─────────────────────────
  //   Il segno del passaggio, e i mestieri solo se li abbiamo davvero: le due
  //   condizioni stanno insieme perché una sola non basta. Senza il segno la
  //   riga non è mai stata rivista da nessuno e il livello deve restare al suo
  //   posto; senza i dati non sappiamo che mestieri fa, e inventarli sarebbe la
  //   cosa peggiore.
  const secondoMestieri =
    p.daMestieri === true && datiConsulente !== undefined && datiConsulente !== null;
  const mestieri = secondoMestieri ? mestieriDi(datiConsulente as ConsultantData | null) : null;

  //  Ordine di precedenza, dal più debole al più forte:
  //  base (mestieri, oppure livello + eredità del nome vecchio) → bandiere
  //  storiche → deroghe.
  const concessi = new Set<Permesso>([
    ...permessiDiPartenza(ruolo, mestieri),
    //  L'eredità del nome vecchio vale solo finché comanda il livello: una riga
    //  passata ai mestieri è stata rivista da una persona, che ha visto in
    //  chiaro che cosa restava acceso e ha salvato. Trascinarsela dietro anche
    //  dopo vorrebbe dire che quelle spunte non si possono più spegnere.
    ...(secondoMestieri ? [] : (EREDITA_STORICA[scritta] ?? [])),
  ]);
  //  ⚠️ E per la stessa ragione le tre bandiere inglesi non comandano più su una
  //   riga passata ai mestieri: sono la memoria di un permesso deciso anni fa, e
  //   lasciarle davanti alle deroghe significherebbe che un
  //   `canChangePayment:false` rimasto in archivio continua a vietare gli
  //   incassi a chi il mestiere del consulente lo fa — senza che si veda da
  //   nessuna parte. Su tutte le altre righe comandano esattamente come prima.
  //  ⚠️ Né su chi il livello non lo ha scritto: lì le bandiere sono quasi
  //   sempre il valore di serie della colonna (canDeleteLead:false…), non una
  //   decisione, e toglierebbero tre cose alla base «vede tutto» senza che la
  //   scheda le mostri. Per restringere si usano le deroghe, che si vedono.
  if (!secondoMestieri && dichiarato) {
    for (const { campo, permesso } of DA_LEGACY) {
      const v = p[campo];
      if (typeof v === "boolean") {
        if (v) concessi.add(permesso);
        else concessi.delete(permesso);
      }
    }
  }
  const extra: Partial<Record<Permesso, boolean>> = {};
  const grezzoExtra = (p.extra ?? {}) as Record<string, unknown>;
  for (const k of TUTTI_I_PERMESSI) {
    const v = grezzoExtra[k];
    if (typeof v !== "boolean") continue;
    extra[k] = v;
    if (v) concessi.add(k);
    else concessi.delete(k);
  }

  //  ── ⚠️ L'EREDITÀ DEL NOME VECCHIO SI DEVE VEDERE, O SI PERDE SALVANDO ───
  //   Quello che il vecchio "responsabile" può fare arriva da `EREDITA_STORICA`
  //   e non da nessuna deroga scritta: nel database quelle sei facoltà non ci
  //   sono, c'è solo la parola "responsabile". La scheda però disegna gli
  //   interruttori leggendo `extra`, e senza queste righe li mostrerebbe tutti
  //   SPENTI su una persona che invece quelle cose le fa — e al primo
  //   salvataggio glieli toglierebbe davvero, perché `daSalvare` scrive le
  //   deroghe che vede. È esattamente il «gli si toglie qualcosa senza che
  //   nessuno l'abbia deciso» che questo file promette di non fare (vedi
  //   NOMI_VECCHI): l'eredità si dichiara qui come deroga accesa, così si legge
  //   nella scheda, sopravvive al passaggio ai mestieri e si spegne una per una
  //   se è quello che si vuole.
  //   ⚠️ Non tocca `concessi` — quelle facoltà ci sono già — e non scavalca una
  //   decisione presa a mano: se qualcuno ha scritto `extra` per quella voce,
  //   comanda la sua, in tutti e due i versi.
  if (!secondoMestieri) {
    for (const k of EREDITA_STORICA[scritta] ?? []) {
      if (extra[k] === undefined && concessi.has(k)) extra[k] = true;
    }
  }

  //  Chi entra, lavora: senza questo un permesso tolto per sbaglio
  //  produrrebbe un CRM che si apre e non fa assolutamente niente.
  concessi.add("lead.propri");

  const puo = (x: Permesso) => concessi.has(x);

  //  I campi storici tornano indietro coerenti con il livello: chi legge
  //  ancora `canDeleteLead` (api/consulente/azione) deve vedere la stessa
  //  risposta che darebbe `puo("lead.elimina")`, o esistono due verità.
  const legacy: ConsultantPermissions = {
    canChangeStatus: p.canChangeStatus ?? DEFAULT_PERMISSIONS.canChangeStatus,
    canChangeTime: p.canChangeTime ?? DEFAULT_PERMISSIONS.canChangeTime,
    canAddNotes: p.canAddNotes ?? DEFAULT_PERMISSIONS.canAddNotes,
    canAddPostCallNotes: p.canAddPostCallNotes ?? DEFAULT_PERMISSIONS.canAddPostCallNotes,
    canChangePayment: puo("pagamenti"),
    canDeleteLead: puo("lead.elimina"),
    canAddLead: puo("lead.crea"),
  };

  return {
    ruolo,
    secondoMestieri,
    dichiarato,
    puo,
    elenco: TUTTI_I_PERMESSI.filter(puo),
    extra,
    legacy,
  };
}

/** L'accesso pieno, per il proprietario dei dati autenticato col proprio
 *  account: è un ADMIN, che è il nome nuovo di quello che era il titolare. */
export const accessoPieno = (): Accesso => risolviAccesso({ ruolo: "admin" });

/** Costruisce un accesso a partire da un elenco già deciso altrove (le schede
 *  di `user_settings.scheme_access`, e l'elenco che il server ha già risolto e
 *  consegnato al browser).
 *  ⚠️ Qui non servono i mestieri, e non è una dimenticanza: l'elenco arriva
 *  GIÀ FATTO: ogni permesso è scritto a chiare lettere fra le deroghe, quindi
 *  qualunque base venga usata sotto non cambia il risultato di una virgola.
 *  Rifare qui il conto dei mestieri significherebbe avere due posti che
 *  rispondono alla stessa domanda, e il secondo lo farebbe con dati più
 *  vecchi. */
export function accessoDaElenco(ruolo: RuoloCRM, elenco: Permesso[]): Accesso {
  const extra: Partial<Record<Permesso, boolean>> = {};
  for (const k of TUTTI_I_PERMESSI) extra[k] = elenco.includes(k);
  return risolviAccesso({ ruolo, extra });
}

/** ── QUELLO CHE SI SCRIVE NELLA RIGA ───────────────────────────────────────
 *  La base (mestieri, o livello) più le SOLE deroghe che se ne discostano.
 *  Salvare anche le altre significherebbe congelare dentro la riga la tabella
 *  di oggi, e cambiarla domani non avrebbe più effetto su nessuno.
 *
 *  `mestieri` non nullo = si sta salvando dalla scheda nuova, e nella riga
 *  finisce anche il segno del passaggio. Da quel momento le deroghe si leggono
 *  rispetto ai mestieri, ed è per questo che il segno e le deroghe si scrivono
 *  SEMPRE insieme, in un solo oggetto: due salvataggi separati lascerebbero, fra
 *  l'uno e l'altro, deroghe misurate su una base che non è più quella. */
export function daSalvare(
  ruolo: RuoloCRM,
  mestieri: Mestieri | null,
  concessi: Permesso[],
): {
  ruolo: RuoloCRM;
  daMestieri?: boolean;
  extra: Partial<Record<Permesso, boolean>>;
} {
  const base = new Set(permessiDiPartenza(ruolo, mestieri));
  const extra: Partial<Record<Permesso, boolean>> = {};
  for (const k of TUTTI_I_PERMESSI) {
    const acceso = concessi.includes(k);
    if (acceso !== base.has(k)) extra[k] = acceso;
  }
  return mestieri ? { ruolo, daMestieri: true, extra } : { ruolo, extra };
}

// ── DOVE SI APPLICANO, NELL'INTERFACCIA ─────────────────────────────────────

/** Le vecchie chiavi delle schede (`user_settings.scheme_access`) tradotte in
 *  permessi. Le due cose convivono: le schede dicono che cosa un ACCOUNT vede,
 *  i permessi che cosa una PERSONA può fare. La barra laterale le chiede
 *  entrambe, e serve il sì di tutte e due. */
export const PERMESSO_DI_SCHEDA: Record<string, Permesso> = {
  nuovi: "lead.assegna",
  leads: "lead.tutti",
  installazioni: "installazioni",
  installazioni_oggi: "installazioni",
  consulenti: "consulenti",
  kpi: "marketing",
  performance: "marketing",
  ads: "marketing",
  agenda: "agenda",
  impostazioni: "impostazioni",
};

/** Il permesso che una pagina del CRM richiede. Serve a due cose: nascondere la
 *  voce di menu, e — più importante — dire qualcosa di sensato a chi la pagina
 *  se la apre lo stesso con l'indirizzo. Il confronto è sul percorso più lungo
 *  che combacia, così `/CRM/installazioni/oggi` non finisce sotto la regola
 *  generica di `/CRM`. */
const PERMESSO_DI_PAGINA: { percorso: string; permesso: Permesso }[] = [
  //  ⚠️ SERVE UNA RIGA SUA, e non la eredita da `/CRM/importa` qui sotto: il
  //   confronto vuole il percorso esatto o un sotto-percorso con la barra
  //   (`p.startsWith(r.percorso + "/")`), e «/CRM/importa-lead» non è né l'uno
  //   né l'altro. Senza questa riga cadrebbe sulla regola generica del CRM, e
  //   la scheda che CARICA i contatti si aprirebbe a chiunque sia entrato —
  //   per poi non lasciargli scrivere niente.
  { percorso: "/CRM/importa-lead", permesso: "lead.crea" },
  { percorso: "/CRM/consulenti", permesso: "consulenti" },
  { percorso: "/CRM/impostazioni", permesso: "impostazioni" },
  //  ⚠️ ERA "archivio", e da quando quella pagina è stata riscritta quel
  //   permesso la chiudeva proprio a chi la usa. Non è più la schermata da cui
  //   si ribalta un backup: è la POSTAZIONE da cui si chiamano i propri lead
  //   importati, uno alla volta. I due comandi pericolosi che ci sono rimasti
  //   dentro si difendono da soli, comando per comando — caricare un file
  //   chiede "lead.crea", dividere le schede fra i consulenti chiede
  //   "lead.assegna" — quindi abbassare il permesso della PAGINA non apre
  //   niente che prima fosse chiuso.
  { percorso: "/CRM/importa", permesso: "lead.propri" },
  //  /CRM/dafare non era in questo elenco affatto: la pagina esisteva e la
  //  vedeva chiunque fosse entrato nel CRM, senza che nessuno lo avesse
  //  deciso. Mostra i propri lead e le cose scritte a mano, quindi chiede il
  //  permesso minimo del lavoro di consulenza — lo stesso della postazione.
  { percorso: "/CRM/dafare", permesso: "lead.propri" },
  { percorso: "/CRM/prezzi", permesso: "listino" },
  { percorso: "/CRM/sconti", permesso: "listino" },
  { percorso: "/CRM/kpi", permesso: "marketing" },
  { percorso: "/CRM/campagne-meta", permesso: "marketing" },
  { percorso: "/CRM/campagne-tiktok", permesso: "marketing" },
  { percorso: "/CRM/attribuzione", permesso: "marketing" },
  { percorso: "/CRM/landing-page", permesso: "marketing" },
  { percorso: "/CRM/installazioni", permesso: "installazioni" },
  { percorso: "/CRM/trattative-perse", permesso: "lead.tutti" },
  { percorso: "/CRM/trattative", permesso: "lead.tutti" },
  { percorso: "/CRM/nuovi-contatti", permesso: "lead.assegna" },
  { percorso: "/CRM/orari-disponibili", permesso: "impostazioni" },
  { percorso: "/CRM/preventivi", permesso: "preventivi" },
  //  ⚠️ Chi viene in sede ci viene per una CONSULENZA: la pagina conta chi è
  //   atteso, chi ha un esito da mettere e quanto c'è da incassare quel
  //   giorno. Nascondere la voce dal menu non basta — l'indirizzo si conosce e
  //   sta nei preferiti — e questa riga è quella che chiude la porta davvero.
  { percorso: "/CRM/sede", permesso: "preventivi" },
  { percorso: "/CRM/agenda", permesso: "agenda" },
];

/** ── DOVE SI ATTERRA APPENA ENTRATI ────────────────────────────────────────
 *  Segnalazione del committente: «il setter appena entra non deve portarlo su
 *  una scheda bloccata, ma direttamente su Lead importati».
 *
 *  ⚠️ IL CRM AVEVA UNA PORTA SOLA PER TUTTI, e dietro quella porta c'è la
 *   giornata di chi fa consulenze. Un setter entrava e trovava una schermata
 *   che parla di cose che non può aprire — e il primo gesto della sua giornata
 *   diventava cercare nel menu la riga giusta, ogni mattina, per un mese.
 *   La postazione del setter è la coda di chiamata: è il lavoro, non una
 *   preferenza.
 *
 *  ⚠️ SI DECIDE DAI PERMESSI, NON DAL LIVELLO. Il livello sta sparendo (vedi
 *   la testata di questo file) e i mestieri si sommano: chi fa il setter E il
 *   consulente non è «un setter», ed è giusto che entri dalla porta grande.
 *   La domanda vera è una sola: questa persona fa consulenze? Se sì, la sua
 *   giornata è la scrivania; se no, è il telefono.
 *
 *  ⚠️ E CHI NON PUÒ NEMMENO QUELLO resta su /CRM: è una pagina che non chiede
 *   nessun permesso, quindi non è mai una porta chiusa in faccia. Mandare
 *   qualcuno su una schermata vietata per «aiutarlo» sarebbe il guasto di
 *   partenza, al contrario. */
export function paginaIniziale(puo: (p: Permesso) => boolean): string {
  if (puo("preventivi")) return "/CRM";
  if (puo("lead.propri")) return "/CRM/importa";
  return "/CRM";
}

export function permessoDiPagina(percorso: string): Permesso | null {
  const p = percorso.replace(/\/+$/, "") || "/CRM";
  let migliore: { percorso: string; permesso: Permesso } | null = null;
  for (const r of PERMESSO_DI_PAGINA) {
    if (p !== r.percorso && !p.startsWith(`${r.percorso}/`)) continue;
    if (!migliore || r.percorso.length > migliore.percorso.length) migliore = r;
  }
  return migliore?.permesso ?? null;
}
