/** ── IL PREVENTIVO DENTRO IL MESSAGGIO ─────────────────────────────────────
 *
 *  Richiesta del committente, con l'esempio scritto a mano: il messaggio che si
 *  manda a chi sta decidendo deve portare «il preventivo che abbiamo fatto
 *  insieme in consulenza», cioè il suo link vero — «e se ha più preventivi deve
 *  mettere più link nello stesso messaggio».
 *
 *  ── PERCHÉ SERVE UNA REGOLA, E NON UN CAMPO ──────────────────────────────
 *  Sulla scheda del cliente c'è `quoteRef`, il numero del preventivo: ma è un
 *  legame DICHIARATO, e in archivio ce l'hanno meno di un preventivo su
 *  quattro. Gli altri si riconoscono dal numero di telefono — è la stessa
 *  regola con cui la pagina Preventivi e la finestra della fattura decidono di
 *  chi è un preventivo (`agganciaLead` in crm/preventivi/dati), e va tenuta
 *  UNA: se qui si collegasse in modo diverso, lo stesso cliente risulterebbe
 *  con due preventivi diversi a seconda della schermata.
 *
 *  ── ⚠️ COSA NON SI MANDA MAI ─────────────────────────────────────────────
 *  · I SOSTITUITI. Un preventivo rifatto porta a un prezzo che non vale più:
 *    mandarlo è peggio che non mandare niente, perché il cliente legge una
 *    cifra e si aspetta quella.
 *  · I PERSI. Quella trattativa è chiusa: il link riaprirebbe un discorso già
 *    finito, con il prezzo di allora.
 *  · PIÙ DI TRE. Un messaggio con otto indirizzi non è un messaggio, è un
 *    elenco: si mandano i più recenti, che sono quelli di cui si è parlato.
 *
 *  ⚠️ IL LINK È QUELLO DEL CLIENTE (`client=1`), non quello del consulente: è
 *   la stessa forma che si copia dal preventivo aperto, e la pagina la usa per
 *   sapere che dall'altra parte c'è il cliente e non chi l'ha preparato.
 *  ⚠️ QUI NON SI APRE NESSUNA CONSULENZA. `linkPreventivo` (shop/quote-link)
 *   crea una sessione a ogni chiamata: va benissimo quando si preme «copia il
 *   link», sarebbe un disastro qui — questi link si compongono per OGNI riga
 *   di un elenco, mentre lo si guarda soltanto.
 *  ⚠️ QUI NON SI LEGGE NIENTE DAL DATABASE: si ricevono le righe e si
 *   risponde. È il motivo per cui questa regola si prova senza archivio (vedi
 *   proveDeiLinkNeiMessaggi).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il minimo che serve sapere di un preventivo per decidere se mandarlo. È un
 *  pezzo di `RigaPreventivo` (crm/preventivi/dati), dichiarato qui in forma
 *  ridotta perché questo file non deve conoscere la tabella. */
export interface PreventivoMandabile {
  quote_ref?: string | null;
  telefono?: string | null;
  status?: string | null;
  created_at?: string | null;
}

/** Il minimo che serve sapere della persona. */
export interface ClienteDelPreventivo {
  quoteRef?: string | null;
  telefono?: string | null;
}

/** Non si mandano: il prezzo che portano non vale più. */
const CHIUSI = new Set(["sostituito", "perso", "annullato"]);

/** Quanti link al massimo in un messaggio. */
export const MAX_LINK = 3;

const cifre = (v: unknown): string => String(v ?? "").replace(/\D/g, "");
const rif = (v: unknown): string => String(v ?? "").trim().toUpperCase();

/** ── I PREVENTIVI DI QUESTA PERSONA, PRONTI DA MANDARE ────────────────────
 *  Dal più recente, senza doppioni, al massimo `MAX_LINK`.
 *  ⚠️ IL NUMERO DICHIARATO SULLA SCHEDA VIENE PRIMA DI TUTTO, anche se è più
 *   vecchio: è l'unico legame che qualcuno ha affermato, mentre il telefono è
 *   un'ipotesi. Se il consulente ha scritto quel numero sulla scheda, è QUELLO
 *   il preventivo di cui si sta parlando. */
export function preventiviDaMandare(
  righe: PreventivoMandabile[] | null | undefined,
  cliente: ClienteDelPreventivo | null | undefined,
  max = MAX_LINK,
): string[] {
  const dichiarato = rif(cliente?.quoteRef);
  const tel = cifre(cliente?.telefono).slice(-9);
  const sue = (righe ?? []).filter((q) => {
    const suo = rif(q?.quote_ref);
    if (!suo) return false;
    if (CHIUSI.has(String(q?.status ?? "").trim().toLowerCase())) return false;
    if (dichiarato && suo === dichiarato) return true;
    //  ⚠️ Sotto le sei cifre non si aggancia NIENTE: con quattro cifre in
    //   comune si attribuirebbe a questa persona mezzo archivio.
    return tel.length >= 6 && cifre(q?.telefono).slice(-9) === tel;
  });
  sue.sort((a, b) => {
    const da = rif(a.quote_ref) === dichiarato ? 1 : 0;
    const db = rif(b.quote_ref) === dichiarato ? 1 : 0;
    if (da !== db) return db - da;
    return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });
  const visti = new Set<string>();
  const out: string[] = [];
  for (const q of sue) {
    const r = rif(q.quote_ref);
    if (visti.has(r)) continue;
    visti.add(r);
    out.push(r);
    if (out.length >= Math.max(1, max)) break;
  }
  return out;
}

/** L'indirizzo che si manda al cliente per UN preventivo. */
export function linkDelPreventivo(ref: string, origine: string): string {
  const r = rif(ref);
  if (!r) return "";
  const base = String(origine || "").replace(/\/+$/, "");
  return `${base}/preventivo?id=${encodeURIComponent(r)}&client=1`;
}

/** Il blocco da mettere nel messaggio: un link per riga, niente altro.
 *  Vuoto se non c'è niente da mandare — e allora sparisce la riga del
 *  messaggio che lo conteneva (è la regola dei segnaposto facoltativi in
 *  crm/whatsapp). */
export function bloccoDeiLink(refs: string[] | null | undefined, origine: string): string {
  return (refs ?? [])
    .map((r) => linkDelPreventivo(r, origine))
    .filter(Boolean)
    .join("\n");
}

/** ── LA RIGA CHE PRESENTA I LINK ───────────────────────────────────────────
 *  ⚠️ STA QUI E NON NEL MODELLO, ed è l'unica riga di testo di questo file:
 *   deve cambiare da sola fra «il preventivo» e «i preventivi». Nel modello
 *   sarebbe una frase fissa, e a chi ha due preventivi arriverebbe «Qui trovi
 *   il preventivo» seguito da due indirizzi. Tutto il resto del messaggio
 *   resta modificabile da /CRM/whatsapp, compreso il fatto di tenere o no
 *   questo blocco. */
export const ETICHETTA_UNO = "Qui trovi il preventivo che abbiamo fatto insieme in consulenza:";
export const ETICHETTA_PIU = "Qui trovi i preventivi che abbiamo fatto insieme in consulenza:";

/** Il blocco intero come finisce nel messaggio: la riga che li presenta e
 *  sotto i link, uno per riga. Vuoto se non c'è niente da mandare. */
export function bloccoPerIlMessaggio(refs: string[] | null | undefined, origine: string): string {
  const link = bloccoDeiLink(refs, origine);
  if (!link) return "";
  return `${link.includes("\n") ? ETICHETTA_PIU : ETICHETTA_UNO}\n${link}`;
}

/** Per ogni persona, il blocco dei suoi link già pronto: lo compone chi ha
 *  letto l'archivio una volta sola, e i messaggi lo trovano già fatto senza
 *  chiedere niente a nessuno (vedi `impostaLinkPreventivi` in crm/whatsapp).
 *  ⚠️ CHI NON HA PREVENTIVI NON ENTRA NELLA MAPPA: una voce vuota e una voce
 *   assente devono essere la stessa cosa per chi legge. */
export function linkPerOgniCliente(
  righe: PreventivoMandabile[] | null | undefined,
  persone: { id: string; quoteRef?: string | null; telefono?: string | null }[] | null | undefined,
  origine: string,
  max = MAX_LINK,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of persone ?? []) {
    const id = String(p?.id ?? "").trim();
    if (!id) continue;
    const blocco = bloccoPerIlMessaggio(preventiviDaMandare(righe, p, max), origine);
    if (blocco) out[id] = blocco;
  }
  return out;
}
