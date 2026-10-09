/** ── LA SALA D'ATTESA CHE NON DIPENDE DAL CANALE ───────────────────────────
 *
 *  Segnalazione del committente: «quando una persona entra rimane in attesa e
 *  non entra mai».
 *
 *  ── DOV'ERA IL PUNTO DEBOLE ──────────────────────────────────────────────
 *  Tutta la porta d'ingresso — «busso», «ti faccio entrare» — viaggiava SOLO
 *  sul canale in tempo reale, e la lista di chi aspetta viveva SOLO nella
 *  memoria della scheda del consulente. Basta che uno dei due capi di quel filo
 *  non risponda e il cliente resta fuori senza che nessuno se ne accorga:
 *
 *   · il canale non si apre o cade (rete mobile, wifi aziendale che chiude i
 *     websocket, quota del servizio, scheda in secondo piano che il telefono
 *     mette in pausa): la bussata non arriva, e al cliente non arriva il via
 *     libera;
 *   · la scheda del consulente si ricarica: la lista di chi stava aspettando
 *     era in memoria, e sparisce;
 *   · il consulente sta su un'altra pagina, o su un altro dispositivo, rispetto
 *     a quella che ha ricevuto la bussata.
 *  In tutti questi casi la pagina del cliente continua a dire «sei in sala
 *  d'attesa» per sempre: è esattamente quello che è stato segnalato.
 *
 *  ── LA SALA D'ATTESA ADESSO STA SUL SERVER ───────────────────────────────
 *  Chi bussa si SCRIVE in una riga della consulenza; il consulente la legge;
 *  la decisione («entra» / «non ora») si scrive nella stessa riga e il cliente
 *  la rilegge. Il canale resta — è la via veloce, istantanea — ma non è più
 *  l'unica: se tace, il giro sul server fa la stessa cosa con qualche secondo
 *  di ritardo. Due strade indipendenti per la stessa porta.
 *
 *  ⚠️ QUI NON SI LEGGE E NON SI SCRIVE NIENTE: ci sono solo le regole della
 *   lista (chi c'è, chi è entrato, chi è troppo vecchio per contare). Il giro
 *   sul database lo fanno le rotte, e così queste regole si provano senza
 *   database — vedi proveDellaSalaAttesa.
 *  ⚠️ LA LISTA SI POTA DA SOLA: chi ha bussato e se n'è andato non deve restare
 *   in eterno sulla schermata del consulente. Chi è in attesa ribussa ogni
 *   pochi secondi, quindi «non si fa vivo da un minuto» vuol dire «non c'è
 *   più». Le decisioni invece durano più a lungo: il cliente deve poterle
 *   leggere anche se in quel momento il telefono era in tasca.
 *  ───────────────────────────────────────────────────────────────────────── */

export type StatoAttesa = "attesa" | "ammesso" | "rifiutato";

export interface PersonaInAttesa {
  pid: string;
  nome: string;
  /** Il dispositivo, quando il browser ce lo lascia leggere: serve a
   *  riconoscere chi ricarica la pagina (il pid cambia, il dispositivo no). */
  dev?: string;
  stato: StatoAttesa;
  /** Ultima volta che si è fatto vivo (o che è stato deciso), in millisecondi. */
  at: number;
  /** ── CHI DICE DI ESSERE, FRA GLI ATTESI ────────────────────────────────
   *  Il gettone scelto nella schermata «chi sei?» (crm/fascia-consulenza).
   *  Serve a due cose: scrivere al consulente il nome della SCHEDA invece di
   *  quello digitato, e legare più avanti il preventivo individuale alla
   *  persona giusta. Assente per chi arriva da un link inoltrato. */
  persona?: string;
}

/** La base della chiave in `app_config`: la riga vera è
 *  `sala_attesa:<codice>` (vedi `chiaveSessione`). */
export const BASE_SALA = "sala_attesa";

/** Quanto vale una bussata prima di considerarla abbandonata. Chi aspetta
 *  ribussa ogni 4 secondi: un minuto sono quindici bussate mancate. */
export const ATTESA_TTL_MS = 60_000;
/** Quanto dura una decisione già presa. Deve sopravvivere a un telefono in
 *  tasca, a una galleria che si apre, a una pagina ricaricata: mezz'ora. */
export const DECISIONE_TTL_MS = 30 * 60_000;
/** ── ⚠️ UN «NON ORA» NON DURA MEZZ'ORA ─────────────────────────────────────
 *  La schermata che legge chi è stato rifiutato dice, con queste parole:
 *  «Riprova fra poco con lo stesso link». Con la vita di una decisione normale
 *  quella frase era falsa: per trenta minuti chi riapriva il link riceveva di
 *  nuovo «rifiutato» — dal server, prima ancora di bussare — e il consulente
 *  non vedeva nessuna richiesta. Un «non ora» premuto per sbaglio, o un cliente
 *  che ti richiama due minuti dopo, restavano fuori senza che nessuno dei due
 *  potesse farci niente.
 *  Due minuti: il tempo di leggere l'avviso, e poi si può bussare di nuovo. Chi
 *  non deve proprio entrare si blocca (il blocco è un'altra cosa e non scade). */
export const RIFIUTO_TTL_MS = 2 * 60_000;

/** Quanto vale ancora una riga, secondo il suo stato. */
export const duraFinoA = (p: PersonaInAttesa): number =>
  p.stato === "attesa" ? ATTESA_TTL_MS : p.stato === "rifiutato" ? RIFIUTO_TTL_MS : DECISIONE_TTL_MS;
/** Non più di così: la riga è un campo di testo, non un archivio. Chi arriva
 *  oltre il tetto non viene scartato — si buttano i più vecchi. */
export const MAX_PERSONE = 40;

const testo = (v: unknown): string => String(v ?? "").trim();

/** Rilegge la lista difendendosi da tutto: la scrive una versione della pagina,
 *  la rilegge un'altra, e in mezzo c'è un campo di testo di un database. Una
 *  riga illeggibile vale «sala vuota»: si riparte, e chi sta aspettando si
 *  riscrive al giro dopo. */
export function leggiSala(grezzo?: string | null): PersonaInAttesa[] {
  if (!grezzo) return [];
  try {
    const v = JSON.parse(grezzo) as { persone?: unknown };
    const dentro = Array.isArray(v?.persone) ? v.persone : Array.isArray(v) ? v : [];
    const out: PersonaInAttesa[] = [];
    for (const x of dentro as Partial<PersonaInAttesa>[]) {
      const pid = testo(x?.pid);
      if (!pid) continue;
      const stato: StatoAttesa =
        x?.stato === "ammesso" ? "ammesso" : x?.stato === "rifiutato" ? "rifiutato" : "attesa";
      out.push({
        pid,
        nome: testo(x?.nome) || "Ospite",
        ...(testo(x?.dev) ? { dev: testo(x?.dev) } : {}),
        stato,
        at: Number(x?.at) || 0,
        ...(testo(x?.persona) ? { persona: testo(x.persona) } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Come si scrive la lista. Una forma sola, per non ritrovarsi due modi di
 *  leggere la stessa riga. */
export const scriviSala = (persone: PersonaInAttesa[]): string => JSON.stringify({ persone });

/** ── CHI CONTA ANCORA ──────────────────────────────────────────────────────
 *  Le bussate scadono in fretta, le decisioni no (vedi in testa). */
export function ripulisci(persone: PersonaInAttesa[], adesso = Date.now()): PersonaInAttesa[] {
  const vive = persone.filter((p) => adesso - p.at < duraFinoA(p));
  //  Oltre il tetto restano i più recenti: se qualcuno deve uscire è chi si è
  //  fatto vivo per ultimo molto tempo fa.
  return vive.length <= MAX_PERSONE
    ? vive
    : vive.slice().sort((a, b) => b.at - a.at).slice(0, MAX_PERSONE);
}

/** ── QUALCUNO BUSSA (O RIBUSSA) ────────────────────────────────────────────
 *  ⚠️ NON SI CANCELLA UNA DECISIONE GIÀ PRESA. Chi è stato fatto entrare
 *   continua a ribussare per qualche secondo — il messaggio di via libera può
 *   essersi incrociato con la sua bussata — e trattare quella bussata come
 *   nuova lo rimetterebbe in sala d'attesa dopo che era già dentro.
 *  ⚠️ E SI RICONOSCE ANCHE DAL DISPOSITIVO: ricaricando la pagina il pid
 *   cambia, e senza questo controllo la stessa persona comparirebbe due volte
 *   al consulente — che ne farebbe entrare una e lascerebbe l'altra alla porta.
 *   La decisione presa per il dispositivo vale per il pid nuovo: è la stessa
 *   persona, e ripetergliela non ha senso. */
export function bussa(
  persone: PersonaInAttesa[],
  chi: { pid: string; nome?: string; dev?: string; persona?: string },
  adesso = Date.now(),
): PersonaInAttesa[] {
  const pid = testo(chi.pid);
  if (!pid) return persone;
  const dev = testo(chi.dev);
  const nome = testo(chi.nome) || "Ospite";
  const persona = testo(chi.persona);
  const lista = ripulisci(persone, adesso);
  const i = lista.findIndex((p) => p.pid === pid);
  if (i >= 0) {
    lista[i] = { ...lista[i], nome, ...(dev ? { dev } : {}), ...(persona ? { persona } : {}), at: adesso };
    return lista;
  }
  //  Stesso dispositivo, pid nuovo: è la stessa persona che ha ricaricato.
  //  Si prende il posto di prima — decisione compresa — invece di aggiungerne
  //  una seconda.
  const j = dev ? lista.findIndex((p) => p.dev && p.dev === dev) : -1;
  if (j >= 0) {
    lista[j] = { ...lista[j], pid, nome, ...(persona ? { persona } : {}), at: adesso };
    return lista;
  }
  lista.push({ pid, nome, ...(dev ? { dev } : {}), ...(persona ? { persona } : {}), stato: "attesa", at: adesso });
  //  ⚠️ Il tetto si rimette DOPO l'inserimento, non solo prima: tagliare a
  //   quaranta e poi aggiungerne uno fa quarantuno, e la riga cresce di uno a
  //   ogni bussata.
  return ripulisci(lista, adesso);
}

/** ── IL CONSULENTE DECIDE ──────────────────────────────────────────────────
 *
 *  Segnalazione del committente: «c'è chi entra senza problemi, e ci sono
 *  altri che anche se li accetto continua a dirgli sei in attesa; rimane
 *  quella schermata come se non avessi mai accettato, e anche cambiando link
 *  continua così».
 *
 *  ── IL PID CON CUI SI DECIDE PUÒ NON ESSERE PIÙ IL SUO ───────────────────
 *  Il pid è di una PAGINA, non di una persona: cambia a ogni ricaricamento, a
 *  ogni schermata riaperta. L'elenco del consulente può quindi tenere un pid
 *  vecchio — gli era arrivato sul canale, o da una consulenza di prima — e
 *  «fai entrare» scriveva la decisione su QUEL pid. Il cliente, che nel
 *  frattempo ne ha un altro, rileggeva la propria riga e trovava «attesa».
 *  In archivio la firma di questo guasto è una riga di troppo:
 *      {pid: '8e68t9um', nome: 'Antonio P.', dev: '7b93…', stato: 'ammesso'}
 *      {pid: 'p0ehn42n', nome: 'Ospite',                   stato: 'ammesso'}
 *  la seconda senza dispositivo e senza nome, cioè nata qui dentro da una
 *  decisione presa su un pid che nella stanza non esisteva più. Il via libera
 *  c'era: non era per nessuno.
 *
 *  ⚠️ PERCIÒ LA DECISIONE PORTA IL DISPOSITIVO. Con quello la si posa sulla
 *   persona: la sua riga di adesso — qualunque pid abbia — diventa «ammesso»,
 *   e se di lei non c'è ancora niente si scrive una riga che il suo prossimo
 *   giro riconosce.
 *  ⚠️ IL VIA LIBERA PUÒ ANCORA PRECEDERE LA BUSSATA: se quella persona non
 *   c'è, la riga si scrive lo stesso — altrimenti chi bussa un istante dopo
 *   resterebbe fuori. */
export function decidi(
  persone: PersonaInAttesa[],
  pid: string,
  stato: StatoAttesa,
  adesso = Date.now(),
  dev = "",
): PersonaInAttesa[] {
  const p = testo(pid);
  const d = testo(dev);
  if (!p && !d) return persone;
  const lista = ripulisci(persone, adesso);
  //  Si cerca per pid; se quel pid non c'è più (ha ricaricato) si cerca la
  //  persona dal dispositivo, che è la sola cosa che non cambia.
  let i = p ? lista.findIndex((x) => x.pid === p) : -1;
  if (i < 0 && d) i = lista.findIndex((x) => x.dev === d);
  if (i >= 0) lista[i] = { ...lista[i], stato, at: adesso, ...(d ? { dev: d } : {}) };
  else lista.push({ pid: p || `dev-${d}`, nome: "Ospite", ...(d ? { dev: d } : {}), stato, at: adesso });
  //  ⚠️ La decisione vale per la PERSONA, non per la scheda: se di quel
  //   dispositivo ci sono altre righe (ha ricaricato mentre decidevi) valgono
  //   anche loro, o quella vecchia lo rimanderebbe in sala d'attesa.
  const suo = d || lista[i >= 0 ? i : lista.length - 1].dev;
  if (suo) for (const x of lista) if (x.dev === suo) { x.stato = stato; x.at = adesso; }
  return ripulisci(lista, adesso);
}

/** ── CHE NE È STATO DI QUESTA PERSONA ──────────────────────────────────────
 *  «sconosciuto» = di lei non si sa niente: per il cliente vuol dire «continua
 *  a bussare», non «sei stato rifiutato».
 *
 *  ⚠️ UNA DECISIONE VALE PIÙ DI UN'ATTESA. Della stessa persona possono
 *   esserci DUE righe — una per la pagina di prima e una per quella di adesso
 *   — e prima si prendeva la prima che capitava: se capitava quella che
 *   diceva ancora «attesa», il cliente restava alla porta con il suo via
 *   libera scritto due righe più sotto. Fra due decisioni vince la più
 *   recente, che è l'ultima cosa che il consulente ha voluto. */
export function statoDi(
  persone: PersonaInAttesa[],
  chi: { pid: string; dev?: string },
  adesso = Date.now(),
): StatoAttesa | "sconosciuto" {
  const pid = testo(chi.pid);
  const dev = testo(chi.dev);
  if (!pid && !dev) return "sconosciuto";
  const lista = ripulisci(persone, adesso);
  const mie = lista.filter((p) => (pid && p.pid === pid) || (dev && p.dev === dev));
  if (!mie.length) return "sconosciuto";
  const decise = mie.filter((p) => p.stato !== "attesa");
  if (!decise.length) return "attesa";
  return decise.slice().sort((a, b) => b.at - a.at)[0].stato;
}

/** Chi sta aspettando adesso, dal più vecchio al più recente: il primo che ha
 *  bussato è il primo che il consulente deve vedere. */
export function inAttesa(persone: PersonaInAttesa[], adesso = Date.now()): PersonaInAttesa[] {
  return ripulisci(persone, adesso)
    .filter((p) => p.stato === "attesa")
    .sort((a, b) => a.at - b.at);
}
