/** ── LA SALA — TUTTO QUELLO CHE TOCCA IL DATABASE ───────────────────────────
 *
 *  Sta in un file solo perché le due porte del webinar — quella del
 *  presentatore (`api.crm.webinar`) e quella degli spettatori
 *  (`api.public.webinar`) — leggono e scrivono le STESSE cose, e due copie si
 *  sarebbero disallineate al primo cambiamento. Quello che cambia fra le due
 *  non è il magazzino: è chi ha il permesso di aprirlo.
 *
 *  ⚠️ SOLO LATO SERVER. Usa la chiave di servizio, che passa sopra l'RLS: se
 *   questo file finisse in un pacchetto servito al browser, quella chiave
 *   uscirebbe con lui. Il suffisso `.server` lo dice a chi legge; a impedirlo
 *   davvero è il fatto che lo importano solo le rotte.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MESSAGGI_PER_GIRO,
  SCADENZA_PRESENZA_MS,
  type InPalco,
  type MessaggioChat,
  type MessaggioProgrammato,
  type RuoloInChat,
  type StatoPalco,
} from "./tipi";

const db = supabaseAdmin as unknown as {
  from: (t: string) => any;
};

/** ── LA SALA PUÒ NON ESSERCI ANCORA ────────────────────────────────────────
 *  Le quattro tabelle nascono da una migrazione che qualcuno deve applicare, e
 *  fra il momento in cui questo codice va in produzione e quello in cui la
 *  migrazione viene lanciata può passare del tempo.
 *
 *  In quella finestra il webinar NON deve rompersi: senza questa rete, la
 *  prima interrogazione a una tabella che non c'è farebbe fallire la risposta
 *  di stato, e chi guarda vedrebbe un errore al posto della diretta — cioè una
 *  funzione nuova, ancora spenta, spegnerebbe quella che già funzionava.
 *  Così invece la sala resta semplicemente vuota: zero presenti, nessun
 *  messaggio, nessuno sul palco. Esattamente com'era prima.
 *
 *  `mancano` si accende alla prima delusione e lo legge la regia, per dire a
 *  chi conduce che c'è una migrazione da lanciare invece di lasciarlo davanti
 *  a una sala che non si popola mai. */
let mancano = false;
export const tabelleMancanti = () => mancano;

/** ⚠️ NON SERVE UN try/catch: supabase-js non alza quando la tabella non c'è,
 *  restituisce `{ data: null, error }`. Il che vuol dire che il degrado dolce
 *  c'è già di suo — le letture tornano vuote, le scritture non fanno niente —
 *  e qui resta solo da ACCORGERSENE, per poterlo dire a chi conduce invece di
 *  lasciarlo davanti a una sala che non si popola mai.
 *  42P01 è il codice PostgreSQL di «questa tabella non esiste»; PostgREST la
 *  racconta anche come «schema cache». */
function nota(r: { error?: { message?: string; code?: string } | null } | null | undefined): void {
  const e = r?.error;
  if (!e) return;
  if (e.code === "42P01" || /does not exist|schema cache/i.test(String(e.message || ""))) mancano = true;
}

const adesso = () => new Date().toISOString();
const daQuando = (ms: number) => new Date(Date.now() - ms).toISOString();

// ══════════════════════════════════════════════════════════════════════════
//  CHI C'È
// ══════════════════════════════════════════════════════════════════════════

/** «Ci sono ancora». Una riga per persona, riscritta a ogni battito: è il
 *  motivo per cui questi dati non stanno in `app_config` — lì sarebbe una riga
 *  sola e cinquecento scritture al secondo se la ruberebbero a vicenda. */
export async function battito(
  codice: string, spettatore: string, nome?: string,
  schermo?: { larghezza?: number; altezza?: number },
): Promise<void> {
  //  ⚠️ `entrato_il` NON compare qui, ed è voluto: ce l'ha la tabella come
  //   valore di partenza, che vale solo all'inserimento. Scrivendolo da qui si
  //   sovrascriverebbe a ogni battito — cioè ogni venti secondi — e ogni
  //   permanenza risulterebbe di zero secondi. Vedi la migrazione.
  nota(await db.from("webinar_presenze").upsert(
    {
      codice, spettatore, nome: nome || null, visto_il: adesso(),
      //  ⚠️ Si salva la MISURA, non la parola «telefono»: le soglie cambiano
      //   ogni due anni e i dati vecchi resterebbero classificati con la
      //   regola vecchia. Vedi la nota nella migrazione.
      ...(Number(schermo?.larghezza) > 0 ? { larghezza: Math.round(Number(schermo!.larghezza)) } : {}),
      ...(Number(schermo?.altezza) > 0 ? { altezza: Math.round(Number(schermo!.altezza)) } : {}),
    },
    { onConflict: "codice,spettatore" },
  ));
}

/** ── LE SOGLIE, IN UN POSTO SOLO ───────────────────────────────────────────
 *  Le stesse che usa il resto del programma per decidere l'impaginazione:
 *  sotto 768 è un telefono, sotto 1024 un tablet, sopra uno schermo grande.
 *  Averle qui e non sparse vuol dire che «in sala c'è gente col telefono» e
 *  «questa pagina si impagina da telefono» significano la stessa cosa. */
export function classeSchermo(larghezza?: number | null): "telefono" | "tablet" | "grande" {
  const w = Number(larghezza) || 0;
  if (w > 0 && w < 768) return "telefono";
  if (w > 0 && w < 1024) return "tablet";
  return "grande";
}

/** Da che schermi stanno guardando ADESSO. Serve al presentatore per sapere
 *  che in sala c'è gente col telefono PRIMA di mostrare una tabella che sul
 *  telefono non si legge — non dopo, leggendo in chat «non si vede niente». */
export async function schermi(codice: string): Promise<{
  telefono: number; tablet: number; grande: number; misure: string[];
}> {
  const { data } = await db.from("webinar_presenze").select("larghezza, altezza")
    .eq("codice", codice).gte("visto_il", daQuando(SCADENZA_PRESENZA_MS)).limit(500);
  const righe = (data as { larghezza: number | null; altezza: number | null }[] | null) ?? [];
  const conto = { telefono: 0, tablet: 0, grande: 0 };
  const quante = new Map<string, number>();
  for (const r of righe) {
    //  Chi non ha ancora mandato la misura non si conta in nessuna classe: un
    //  «grande» inventato per assenza di dati farebbe credere al presentatore
    //  che può mostrare la tabella.
    if (!Number(r.larghezza)) continue;
    conto[classeSchermo(r.larghezza)]++;
    const k = `${r.larghezza}×${r.altezza || "?"}`;
    quante.set(k, (quante.get(k) ?? 0) + 1);
  }
  return {
    ...conto,
    //  Le tre misure più diffuse, per dire non solo «c'è chi guarda dal
    //  telefono» ma quale telefono.
    misure: [...quante.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n})`),
  };
}

export async function conta(codice: string): Promise<{ presenti: number; passate: number }> {
  const [vivi, tutti] = await Promise.all([
    db.from("webinar_presenze").select("spettatore", { count: "exact", head: true })
      .eq("codice", codice).gte("visto_il", daQuando(SCADENZA_PRESENZA_MS)),
    db.from("webinar_presenze").select("spettatore", { count: "exact", head: true }).eq("codice", codice),
  ]);
  nota(vivi);
  return { presenti: Number(vivi?.count) || 0, passate: Number(tutti?.count) || 0 };
}

/** Chi c'è adesso, con il nome. Serve SOLO al presentatore: allo spettatore si
 *  manda il numero, non l'elenco di chi altro sta guardando un webinar su un
 *  trattamento che riguarda il corpo. */
export async function presenti(codice: string): Promise<{ spettatore: string; nome: string }[]> {
  const { data } = await db.from("webinar_presenze").select("spettatore, nome")
    .eq("codice", codice).gte("visto_il", daQuando(SCADENZA_PRESENZA_MS))
    .order("visto_il", { ascending: false }).limit(500);
  return ((data as { spettatore: string; nome: string | null }[] | null) ?? [])
    .map((r) => ({ spettatore: r.spettatore, nome: r.nome || "Ospite" }));
}

// ══════════════════════════════════════════════════════════════════════════
//  LA CHAT
// ══════════════════════════════════════════════════════════════════════════

const vestiMessaggio = (r: Record<string, unknown>): MessaggioChat => ({
  id: String(r.id),
  ...(r.spettatore ? { spettatoreId: String(r.spettatore) } : {}),
  autore: String(r.autore || "Ospite"),
  ruolo: (String(r.ruolo || "ospite") as RuoloInChat),
  testo: String(r.testo || ""),
  fissato: !!r.fissato,
  creatoIl: String(r.creato_il || ""),
});

export async function scrivi(
  codice: string,
  m: { spettatore?: string; autore: string; ruolo: RuoloInChat; testo: string; fissa?: boolean },
): Promise<MessaggioChat | null> {
  const testo = String(m.testo || "").trim().slice(0, 500);
  if (!testo) return null;
  //  Un solo messaggio fisso alla volta: due «importanti» in cima non sono due
  //  avvisi, sono nessun avviso.
  if (m.fissa) await db.from("webinar_messaggi").update({ fissato: false }).eq("codice", codice).eq("fissato", true);
  const { data } = await db.from("webinar_messaggi").insert({
    codice,
    spettatore: m.spettatore || null,
    autore: String(m.autore || "Ospite").slice(0, 60),
    ruolo: m.ruolo,
    testo,
    fissato: !!m.fissa,
  }).select().limit(1);
  const r = (data as Record<string, unknown>[] | null)?.[0];
  return r ? vestiMessaggio(r) : null;
}

export async function messaggi(codice: string): Promise<{ elenco: MessaggioChat[]; fissato: MessaggioChat | null }> {
  const [recenti, inCima] = await Promise.all([
    db.from("webinar_messaggi").select("*").eq("codice", codice)
      .order("creato_il", { ascending: false }).limit(MESSAGGI_PER_GIRO),
    db.from("webinar_messaggi").select("*").eq("codice", codice).eq("fissato", true)
      .order("creato_il", { ascending: false }).limit(1),
  ]);
  const elenco = ((recenti?.data as Record<string, unknown>[] | null) ?? []).map(vestiMessaggio).reverse();
  const f = ((inCima?.data as Record<string, unknown>[] | null) ?? [])[0];
  return { elenco, fissato: f ? vestiMessaggio(f) : null };
}

export async function fissa(codice: string, id: string, acceso: boolean): Promise<void> {
  await db.from("webinar_messaggi").update({ fissato: false }).eq("codice", codice).eq("fissato", true);
  if (acceso) await db.from("webinar_messaggi").update({ fissato: true }).eq("codice", codice).eq("id", id);
}

export async function cancellaMessaggio(codice: string, id: string): Promise<void> {
  await db.from("webinar_messaggi").delete().eq("codice", codice).eq("id", id);
}

// ══════════════════════════════════════════════════════════════════════════
//  IL PALCO
// ══════════════════════════════════════════════════════════════════════════

const vestiPalco = (r: Record<string, unknown>): InPalco => ({
  spettatore: String(r.spettatore),
  nome: String(r.nome || "Ospite"),
  stato: (String(r.stato || "attesa") as StatoPalco),
  microfono: !!r.microfono,
  parla: !!r.parla,
  ...(r.session_id ? { sessionId: String(r.session_id) } : {}),
  ...(r.traccia_audio ? { tracciaAudio: String(r.traccia_audio) } : {}),
  ...(r.traccia_video ? { tracciaVideo: String(r.traccia_video) } : {}),
});

export async function palco(codice: string): Promise<InPalco[]> {
  const { data } = await db.from("webinar_palco").select("*").eq("codice", codice)
    .order("salito_il", { ascending: true });
  return ((data as Record<string, unknown>[] | null) ?? []).map(vestiPalco);
}

/** Alza la mano. Non fa salire nessuno: mette in fila, e decide il presentatore. */
export async function alzaMano(codice: string, spettatore: string, nome: string): Promise<void> {
  const { data } = await db.from("webinar_palco").select("stato").eq("codice", codice).eq("spettatore", spettatore).limit(1);
  //  Chi è GIÀ sul palco non torna in attesa perché ha toccato di nuovo il
  //  pulsante: si toglierebbe la parola da solo mentre parla.
  if (((data as { stato: string }[] | null) ?? [])[0]) return;
  await db.from("webinar_palco").upsert(
    { codice, spettatore, nome: String(nome || "Ospite").slice(0, 60), stato: "attesa", microfono: false, parla: false, salito_il: adesso() },
    { onConflict: "codice,spettatore" },
  );
}

/** Il presentatore fa salire qualcuno, e decide se solo voce o anche faccia.
 *  Il lasciapassare nasce QUI: senza, nessuno spettatore può pubblicare niente
 *  nella sala, perché la porta pubblica lo pretende. */
export async function faiSalire(
  codice: string, spettatore: string, stato: "audio" | "video", nome?: string,
): Promise<string> {
  const pass = crypto.randomUUID().replace(/-/g, "");
  //  ── ⚠️ UPSERT E NON UPDATE, ED È IL DIFETTO CHE C'ERA QUI ───────────────
  //   Un `update` cambia una riga che ESISTE. La riga sul palco però nasce
  //   quando qualcuno alza la mano — e la maggior parte delle volte non è così
  //   che si dà la parola: si legge una domanda in chat e si fa salire chi
  //   l'ha scritta, che la mano non l'ha alzata mai.
  //   Su quella persona l'`update` non trovava niente da cambiare e usciva
  //   dicendo che era andato tutto bene: nessun errore, nessuna riga, e il
  //   pulsante che sembrava non funzionare.
  await db.from("webinar_palco").upsert(
    {
      codice, spettatore,
      nome: String(nome || "").trim().slice(0, 60) || "Ospite",
      stato, pass, microfono: true, parla: false, salito_il: adesso(),
    },
    { onConflict: "codice,spettatore" },
  );
  return pass;
}

export async function faiScendere(codice: string, spettatore: string): Promise<void> {
  await db.from("webinar_palco").delete().eq("codice", codice).eq("spettatore", spettatore);
}

/** Apre o chiude il microfono di chi è sul palco. È il gesto che si fa dalla
 *  chat, senza cercare la persona in nessun elenco. */
export async function microfono(codice: string, spettatore: string, acceso: boolean): Promise<void> {
  await db.from("webinar_palco").update({ microfono: acceso }).eq("codice", codice).eq("spettatore", spettatore);
}

/** Accende e spegne la CAMERA di chi è sul palco.
 *  ⚠️ NON SERVE UN CAMPO NUOVO, e non è una furbata: lo stato È già la
 *   risposta. «audio» vuol dire che parla e basta, «video» che parla e si
 *   vede. Spegnere la camera è passare da video ad audio, riaccenderla il
 *   contrario — e il browser di chi è sul palco, che quello stato lo legge già
 *   per sapere cosa pubblicare, si adegua da sé. Un campo in più avrebbe
 *   voluto dire due verità sulla stessa cosa, e prima o poi due verità
 *   diverse. */
export async function cameraOspite(codice: string, spettatore: string, accesa: boolean): Promise<void> {
  await db.from("webinar_palco").update({ stato: accesa ? "video" : "audio" })
    .eq("codice", codice).eq("spettatore", spettatore).neq("stato", "attesa");
}

/** ── CHI SI È ISCRITTO ─────────────────────────────────────────────────────
 *  ⚠️ Il numero arriva GIÀ normalizzato (vedi `webinar/iscrizione`): la chiave
 *   della tabella è (codice, contatto), quindi lo stesso telefono scritto in
 *   cinque modi diversi darebbe cinque persone. Normalizzare qui e non lì
 *   vorrebbe dire una regola che si può provare solo con un database davanti.
 *  ⚠️ Iscriversi due volte non è un errore e non lo si dice: si aggiorna il
 *   nome e basta. Chi riapre il link e si iscrive di nuovo sta facendo una
 *   cosa ragionevole, e rispondergli «sei già iscritto» lo lascia col dubbio
 *   di non esserlo. */
/** ⚠️ QUESTA DICE SE HA FUNZIONATO, al contrario di quasi tutte le altre qui
 *  dentro. Le altre possono fallire in silenzio perché il peggio che succede è
 *  un contatore fermo; qui il peggio è una persona che legge «ci sei, ti
 *  avviso» e non riceve niente — le abbiamo preso il numero e le abbiamo detto
 *  una cosa falsa. Se la tabella non c'è ancora, meglio dirle di riprovare. */
export async function iscrivi(codice: string, contatto: string, nome: string): Promise<boolean> {
  const r = await db.from("webinar_iscritti").upsert(
    { codice, contatto, nome: nome || null },
    { onConflict: "codice,contatto" },
  );
  nota(r);
  return !r.error;
}

/** Quanti si sono iscritti davvero. */
export async function quantiIscritti(codice: string): Promise<number> {
  const r = await db.from("webinar_iscritti").select("contatto").eq("codice", codice).limit(20_000);
  nota(r);
  return ((r.data ?? []) as unknown[]).length;
}

/** Chi va avvisato adesso.
 *  ⚠️ `da` è il momento oltre il quale un avviso è «già stato mandato»: chi ha
 *   ricevuto il promemoria di un'ora fa NON deve ricevere anche quello di
 *   «siamo in diretta» se sono passati due minuti. Un promemoria doppio è il
 *   modo più veloce di farsi bloccare il numero, e su WhatsApp un blocco non
 *   si toglie. */
export async function daAvvisare(
  codice: string, silenzioMs: number,
): Promise<{ contatto: string; nome: string | null }[]> {
  const r = await db.from("webinar_iscritti")
    .select("contatto, nome, avvisato_il").eq("codice", codice).limit(20_000);
  nota(r);
  const soglia = Date.now() - Math.max(0, silenzioMs);
  return ((r.data ?? []) as { contatto: string; nome: string | null; avvisato_il?: string }[])
    .filter((x) => !x.avvisato_il || Date.parse(x.avvisato_il) < soglia)
    .map((x) => ({ contatto: x.contatto, nome: x.nome }));
}

/** Segna che l'avviso è partito. ⚠️ Si scrive DOPO l'invio riuscito, uno per
 *  uno: segnandoli tutti prima, un errore a metà lascerebbe la seconda metà
 *  marcata come avvisata senza aver ricevuto niente. */
export async function segnaAvvisato(codice: string, contatto: string): Promise<void> {
  nota(await db.from("webinar_iscritti")
    .update({ avvisato_il: adesso() }).eq("codice", codice).eq("contatto", contatto));
}

/** ── I GESTI CHE CONTANO ───────────────────────────────────────────────────
 *  ⚠️ Una riga per persona e per gesto, non una per clic: la domanda è «quante
 *   persone l'hanno fatto», non «quante volte è stato premuto». Chi torna
 *   indietro e ripreme non conta due volte — altrimenti il tasso di
 *   conversione può superare il cento per cento, e un numero impossibile
 *   toglie fiducia a tutti gli altri.
 *  ⚠️ Non rompe MAI la sala: se la tabella non c'è ancora, il gesto si perde e
 *   la diretta continua. Una misura che spegne la cosa che sta misurando è
 *   peggio di nessuna misura. */
export async function segnaAzione(codice: string, spettatore: string, azione: string): Promise<void> {
  nota(await db.from("webinar_azioni").upsert(
    { codice, spettatore, azione, quando: adesso() },
    { onConflict: "codice,spettatore,azione" },
  ));
}

/** Com'è andata: le presenze e i gesti di una diretta.
 *  ⚠️ Torna i DATI GREZZI e non il risultato: il conto lo fa
 *   `webinar/misura-diretta`, che è provato e non tocca il database. Farlo qui
 *   vorrebbe dire una regola che si può leggere solo in produzione. */
export async function perLaMisura(codice: string): Promise<{
  presenze: { entrata: number; uscita: number }[];
  conversioni: number;
}> {
  const p = await db.from("webinar_presenze")
    .select("entrato_il, visto_il").eq("codice", codice).limit(5000);
  nota(p);
  const a = await db.from("webinar_azioni")
    .select("spettatore").eq("codice", codice).eq("azione", "whatsapp").limit(5000);
  nota(a);
  const righe = (p.data ?? []) as { entrato_il?: string; visto_il?: string }[];
  return {
    presenze: righe.map((r) => ({
      entrata: Date.parse(String(r.entrato_il ?? r.visto_il ?? "")),
      uscita: Date.parse(String(r.visto_il ?? "")),
    })),
    conversioni: ((a.data ?? []) as unknown[]).length,
  };
}

/** ── LA CODA DELLA MANO ALZATA ─────────────────────────────────────────────
 *  In che posizione sta chi ha chiesto la parola. Serve a LUI, non a te: uno
 *  che alza la mano e non sa se è il primo o il dodicesimo la riabbassa e se
 *  ne va. Sapere «sei il terzo» è la differenza fra aspettare e mollare.
 *  L'ordine è quello in cui hanno alzato la mano — l'unico che non si debba
 *  spiegare. */
export async function codaDellaMano(codice: string): Promise<string[]> {
  const { data } = await db.from("webinar_palco").select("spettatore, salito_il")
    .eq("codice", codice).eq("stato", "attesa").order("salito_il", { ascending: true });
  return ((data as { spettatore: string }[] | null) ?? []).map((r) => r.spettatore);
}

/** «Sto parlando adesso» — lo scrive il browser di chi è sul palco quando il
 *  suo microfono supera la soglia. È l'unico campo che cambia spesso, e serve
 *  solo a far illuminare l'icona: se si perde un aggiornamento non succede
 *  niente di grave. */
export async function segnalaVoce(codice: string, spettatore: string, parla: boolean): Promise<void> {
  await db.from("webinar_palco").update({ parla }).eq("codice", codice).eq("spettatore", spettatore);
}

/** Il lasciapassare di questa persona, per verificarlo quando prova a salire. */
export async function passDi(codice: string, spettatore: string): Promise<{ pass: string | null; stato: StatoPalco } | null> {
  const { data } = await db.from("webinar_palco").select("pass, stato").eq("codice", codice).eq("spettatore", spettatore).limit(1);
  const r = ((data as { pass: string | null; stato: string }[] | null) ?? [])[0];
  return r ? { pass: r.pass, stato: r.stato as StatoPalco } : null;
}

export async function registraTracce(
  codice: string, spettatore: string, t: { sessionId: string; audio?: string; video?: string },
): Promise<void> {
  await db.from("webinar_palco").update({
    session_id: t.sessionId, traccia_audio: t.audio || null, traccia_video: t.video || null,
  }).eq("codice", codice).eq("spettatore", spettatore);
}

// ══════════════════════════════════════════════════════════════════════════
//  I MESSAGGI PROGRAMMATI
// ══════════════════════════════════════════════════════════════════════════

const vestiProgrammato = (r: Record<string, unknown>): MessaggioProgrammato => ({
  id: String(r.id),
  minuto: Number(r.minuto) || 0,
  testo: String(r.testo || ""),
  fissa: !!r.fissa,
  inviatoIl: r.inviato_il ? String(r.inviato_il) : null,
});

export async function programmati(codice: string): Promise<MessaggioProgrammato[]> {
  const { data } = await db.from("webinar_programmati").select("*").eq("codice", codice)
    .order("minuto", { ascending: true });
  return ((data as Record<string, unknown>[] | null) ?? []).map(vestiProgrammato);
}

export async function creaProgrammato(codice: string, minuto: number, testo: string, fissa: boolean): Promise<void> {
  await db.from("webinar_programmati").insert({
    codice, minuto: Math.max(0, Math.round(minuto) || 0), testo: String(testo).trim().slice(0, 500), fissa,
  });
}

export async function eliminaProgrammato(codice: string, id: string): Promise<void> {
  await db.from("webinar_programmati").delete().eq("codice", codice).eq("id", id);
}

/** Azzera i «già inviato» — serve quando si rifà la stessa diretta un'altra
 *  volta, altrimenti la seconda sessione partirebbe con tutti i messaggi già
 *  considerati spediti e non ne uscirebbe nessuno. */
export async function riarmaProgrammati(codice: string): Promise<void> {
  await db.from("webinar_programmati").update({ inviato_il: null }).eq("codice", codice);
}

/** I messaggi il cui minuto è arrivato e che non sono ancora partiti.
 *  ⚠️ Il segno di spedito si mette PRIMA di scrivere in chat: se il presentatore
 *   ha due schede aperte, entrambe chiedono, ma solo una trova ancora la riga
 *   da marcare. Al contrario, il messaggio uscirebbe due volte. */
export async function daSpedire(codice: string, minutiTrascorsi: number): Promise<MessaggioProgrammato[]> {
  const { data } = await db.from("webinar_programmati").select("*")
    .eq("codice", codice).is("inviato_il", null).lte("minuto", Math.floor(minutiTrascorsi));
  const candidati = ((data as Record<string, unknown>[] | null) ?? []).map(vestiProgrammato);
  const usciti: MessaggioProgrammato[] = [];
  for (const c of candidati) {
    const { data: presa } = await db.from("webinar_programmati")
      .update({ inviato_il: adesso() }).eq("id", c.id).is("inviato_il", null).select("id");
    if (((presa as unknown[] | null) ?? []).length) usciti.push(c);
  }
  return usciti;
}

// ══════════════════════════════════════════════════════════════════════════

/** Sgombera la sala. Si chiama quando la stanza viene eliminata: senza, le
 *  presenze e i messaggi di webinar vecchi resterebbero lì per sempre. */
export async function sgombera(codice: string): Promise<void> {
  await Promise.all([
    db.from("webinar_presenze").delete().eq("codice", codice),
    db.from("webinar_messaggi").delete().eq("codice", codice),
    db.from("webinar_palco").delete().eq("codice", codice),
    db.from("webinar_programmati").delete().eq("codice", codice),
  ]);
}

/** Ricomincia da capo mantenendo la sala: via presenze, chat e palco, e i
 *  programmati tornano da spedire. È quello che serve fra una replica e
 *  l'altra dello stesso webinar. */
export async function rifai(codice: string): Promise<void> {
  await Promise.all([
    db.from("webinar_presenze").delete().eq("codice", codice),
    db.from("webinar_messaggi").delete().eq("codice", codice),
    db.from("webinar_palco").delete().eq("codice", codice),
    riarmaProgrammati(codice),
  ]);
}
