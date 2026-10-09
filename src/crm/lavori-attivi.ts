/** ── L'INTERRUTTORE DEI LAVORI VALE PER TUTTO IL GIRO ──────────────────────
 *
 *  Si accende su una riga e si accende su TUTTE quelle dello stesso stato.
 *  Non è una comodità: è come si lavora davvero. Stamattina si riprendono le
 *  vecchie consulenze — «In valutazione», venti righe — e i lavori servono a
 *  tutte e venti; accenderlo venti volte vuol dire dimenticarselo alla terza,
 *  e ritrovarsi metà giro con il link e metà senza senza sapere quale metà.
 *
 *  ⚠️ PER STATO, NON PER TUTTI. Gli stati sono giri diversi: chi è «In
 *   valutazione» sta decidendo e i lavori lo aiutano; chi ha «Appuntamento
 *   fissato» riceve una conferma con giorno e link della stanza, e infilarci
 *   dentro un secondo link è il modo più veloce per fargli aprire quello
 *   sbagliato. Accendere ovunque avrebbe spostato l'errore, non tolto.
 *
 *  ── DOVE VIVE ────────────────────────────────────────────────────────────
 *  In memoria, più una copia in `sessionStorage`: un giro di telefonate passa
 *  da tre schermate — «Da fare oggi», la scheda del cliente, la pagina «Oggi»
 *  — e un interruttore che si spegne cambiando pagina è un interruttore che
 *  non si usa. Per scheda del browser e non per sempre: domani è un altro
 *  giro, e ritrovarlo acceso da ieri manderebbe link a chi non c'entra.
 */
const CHIAVE = "hg.crm.lavori-attivi";

/** Chi guarda: React si riabbona da solo, e ogni tasto dello stesso stato si
 *  ridisegna quando uno qualunque viene commutato. */
const ascoltatori = new Set<() => void>();

function leggiSalvati(): Set<string> {
  try {
    const grezzo = sessionStorage.getItem(CHIAVE);
    const lista = grezzo ? (JSON.parse(grezzo) as unknown) : [];
    return new Set(Array.isArray(lista) ? lista.map(String) : []);
  } catch {
    //  Scheda in incognito, memoria piena, JSON storto: si riparte spenti, che
    //  è lo stato innocuo — un link in meno si rimette, uno in più è partito.
    return new Set();
  }
}

let attivi: Set<string> = typeof sessionStorage === "undefined" ? new Set() : leggiSalvati();

function salva(): void {
  try {
    sessionStorage.setItem(CHIAVE, JSON.stringify([...attivi]));
  } catch {
    /* pazienza: resta acceso in memoria per questa schermata */
  }
}

/** La parte che si può provare senza un browser: dato l'insieme e uno stato,
 *  torna l'insieme dopo il tocco. ⚠️ Uno stato vuoto non si accende: sarebbe
 *  un interruttore che vale per «tutte le schede senza stato», cioè per righe
 *  che non c'entrano niente fra loro. */
export function commuta(insieme: Set<string>, stato: string): Set<string> {
  const s = String(stato ?? "").trim();
  if (!s) return insieme;
  const dopo = new Set(insieme);
  if (dopo.has(s)) dopo.delete(s);
  else dopo.add(s);
  return dopo;
}

export function lavoriAttiviPer(stato: string): boolean {
  const s = String(stato ?? "").trim();
  return !!s && attivi.has(s);
}

export function commutaLavori(stato: string): void {
  const dopo = commuta(attivi, stato);
  if (dopo === attivi) return;
  attivi = dopo;
  salva();
  for (const f of ascoltatori) f();
}

export function ascoltaLavori(f: () => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}

/** Solo per le prove: riporta tutto spento. */
export function azzeraLavori(): void {
  attivi = new Set();
  salva();
  for (const f of ascoltatori) f();
}
