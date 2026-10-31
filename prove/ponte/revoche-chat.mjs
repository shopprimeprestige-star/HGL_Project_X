/** ── PROVE: LE REVOCHE DEL PONTE · LA CHAT NASCONDE I MESSAGGI ELIMINATI ─────
 *
 *  Commessa 2026-10-31, ponte-revoche. I messaggi con `eliminato_il` (nostri, eliminati per tutti dal
 *  telefono) non si mostrano in chat, come i doppioni del ponte, e non contano più come nostra ultima
 *  uscita. Le letture sono quelle di `useChatWa` (messaggi recenti, chat aperta, lettura a pezzi) e le
 *  regole pure di `stato.ts`, `costruisciChat.ts` e `daChiamare.ts`. I componenti non si toccano:
 *  si filtra nelle letture e nei tipi. Dati inventati.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NUM = "+393330007010";
const UT = "00000000-0000-4000-8000-0000000000a1";
const riga = (id, direction, alle, extra = {}) => ({
  id,
  user_id: UT,
  lead_id: null,
  direction,
  from_number: direction === "inbound" ? NUM : "baileys",
  to_number: direction === "inbound" ? "baileys" : NUM,
  body: `testo ${id}`,
  status: direction === "inbound" ? "delivered" : "sent",
  wa_message_id: `bw:393330007010:${id}`,
  error_message: null,
  created_at: `2026-10-31T${alle}.000Z`,
  delivered_at: null,
  read_at: null,
  canale: "baileys",
  duplicato_di: null,
  eliminato_il: null,
  cambiato_il: `2026-10-31T${alle}.000Z`,
  ...extra,
});

export async function provePonteRevocheChat(mod, { c, gruppo, radice }) {
  const S = mod["chatwa/stato"];
  const D = mod["chatwa/daChiamare"];
  const CC = mod["chatwa/costruisciChat"];
  const ELIMINATO = "2026-10-31T11:00:00.000Z";

  gruppo("PONTE WHATSAPP · REVOCHE · LA CHAT NON MOSTRA I MESSAGGI ELIMINATI (stato.ts)");
  const a = riga("A", "inbound", "10:00:00");
  const b = riga("B", "outbound", "10:05:00");
  const bEl = { ...b, eliminato_il: ELIMINATO };
  c("senzaDoppioni toglie anche le righe con eliminato_il (e i doppioni di sempre)", ["A"], S.senzaDoppioni([a, bEl, riga("D", "outbound", "10:06:00", { duplicato_di: "x" })]).map((r) => r.id));
  c("…una riga senza la colonna (migrazione non applicata) resta com'è", ["A", "B"], S.senzaDoppioni([{ ...a, eliminato_il: undefined }, (({ eliminato_il, ...r }) => r)(b)]).map((r) => r.id));
  c("unisciMessaggi: una riga arrivata dalla lettura a pezzi con eliminato_il esce dalla pagina", ["A"], S.unisciMessaggi([a, b], [bEl]).map((r) => r.id));
  c("…le altre restano in ordine e non si muta l'ingresso", [["A", "C"], ["A", "B"]], (() => {
    const prima = [a, b];
    const dopo = S.unisciMessaggi(prima, [bEl, riga("C", "inbound", "10:30:00")]);
    return [dopo.map((r) => r.id), prima.map((r) => r.id)];
  })());
  c("unisciMessaggi: una riga eliminata che arriva per prima non entra mai", ["A"], S.unisciMessaggi([a], [riga("Z", "outbound", "10:40:00", { eliminato_il: ELIMINATO })]).map((r) => r.id));

  //  leggiSenzaDoppioni: il database filtra (leggi(true)); senza la colonna si rilegge senza filtro e si scarta qui.
  const esito = (data, error = null) => ({ data, error });
  const letta = await S.leggiSenzaDoppioni(async (filtra) => (filtra ? esito([a]) : esito([a, bEl])));
  c("leggiSenzaDoppioni: con la colonna il filtro lo fa il database (si passa `filtra` vero)", [[a]], [letta.data]);
  const senza = await S.leggiSenzaDoppioni(async (filtra) => (filtra ? esito(null, { code: "42703", message: "colonna assente" }) : esito([a, bEl, riga("D", "outbound", "10:06:00", { duplicato_di: "x" })])));
  c("leggiSenzaDoppioni: colonna assente (42703) → rilettura senza filtro e scarto qui, eliminati compresi", ["A"], senza.data.map((r) => r.id));

  gruppo("PONTE WHATSAPP · REVOCHE · «DA RISPONDERE», ULTIMA USCITA E ANTEPRIMA (costruisciChat, daChiamare)");
  //  Il cliente scrive (10:00), noi rispondiamo dal telefono (10:05), poi eliminiamo la risposta per tutti.
  //  Il database ha già riportato il contatto all'ultimo messaggio rimasto (ponte_wa_revoca).
  const contattoDopo = {
    id: "k1",
    user_id: UT,
    phone_e164: NUM,
    lead_id: null,
    display_name: null,
    last_message_at: "2026-10-31T10:00:00.000Z",
    unread_count: 1,
    created_at: "2026-10-31T09:00:00.000Z",
    ultimo_in_entrata_il: "2026-10-31T10:00:00.000Z",
    ultimo_in_entrata_anteprima: "testo A",
    risposto_il: null,
    ultimo_messaggio_il: "2026-10-31T10:00:00.000Z",
    ultimo_messaggio_anteprima: "testo A",
    ultimo_messaggio_direzione: "inbound",
  };
  const ADESSO = Date.parse("2026-10-31T12:00:00.000Z");
  const chat = (righe, contacts) => CC.costruisciChat({ tutti: S.unisciMessaggi([], righe), contacts, leads: [], adesso: ADESSO, ottimistici: {} })[0];
  const dopo = chat([a, bEl], [contattoDopo]);
  c("chat con la risposta eliminata: l'ultimo messaggio è quello del cliente, non la nostra uscita", ["A", "inbound"], [dopo.lastMessage?.id, dopo.lastMessage?.direction]);
  c("…e il cliente torna in «Da rispondere» dal suo messaggio (la nostra risposta non c'è più)", [true, "2026-10-31T10:00:00.000Z"], [dopo.daRispondere?.attesa, dopo.daRispondere?.dal]);
  const prima = chat([a, b], [{ ...contattoDopo, risposto_il: "2026-10-31T10:05:00.000Z", ultimo_messaggio_il: "2026-10-31T10:05:00.000Z", ultimo_messaggio_anteprima: "testo B", ultimo_messaggio_direzione: "outbound" }]);
  c("(controllo) con la risposta non eliminata la chat NON è in «Da rispondere» e l'ultimo è la nostra uscita", [false, "B"], [prima.daRispondere?.attesa, prima.lastMessage?.id]);
  c("la finestra delle 24 ore non cambia: dipende dai messaggi del cliente (10:00 + 24 ore)", [true, prima.finestra?.scadeIl], [dopo.finestra?.aperta, dopo.finestra?.scadeIl]);
  c("un messaggio eliminato non crea una chat: chi ha solo messaggi eliminati non compare dalle righe", 0, CC.costruisciChat({ tutti: S.unisciMessaggi([], [bEl]), contacts: [], leads: [], adesso: ADESSO, ottimistici: {} }).length);

  //  «Da chiamare» (attesa su WhatsApp): la nostra uscita eliminata non è il nostro ultimo messaggio.
  const dati = { stato: "attesa_whatsapp", statoPrecedenteIl: "2026-10-30T08:00:00.000Z" };
  const adesso = new Date("2026-10-31T12:00:00.000Z");
  const nostra = { direction: "outbound", created_at: "2026-10-30T09:00:00.000Z", canale: "baileys", body: "x", status: "sent", from_number: "baileys", to_number: NUM };
  const entrata = { direction: "inbound", created_at: "2026-10-30T07:00:00.000Z", canale: "manychat", body: "ciao", status: "delivered", from_number: NUM, to_number: "manychat" };
  const dc = (messaggi) => D.calcolaDaChiamare({ dati, messaggi, adesso });
  c("attesa/Da chiamare: con la nostra uscita l'attesa conta dalla sua ora (09:00)", { si: true, dal: "2026-10-30T09:00:00.000Z" }, dc([entrata, nostra]));
  c("…se la nostra uscita è eliminata conta come se non ci fosse (dall'ingresso nello stato, 08:00)", { si: true, dal: "2026-10-30T08:00:00.000Z" }, dc([entrata, { ...nostra, eliminato_il: ELIMINATO }]));
  c("…un'uscita eliminata non fa da testo per riconoscere l'eco di ManyChat", 0, D.righeEco([{ direction: "outbound", created_at: "2026-10-30T09:00:00.000Z", body: "Va bene", to_number: NUM, eliminato_il: ELIMINATO }, { direction: "inbound", canale: "manychat", created_at: "2026-10-30T09:00:10.000Z", body: "Va bene", from_number: NUM }]).size);
  c("…ma senza eliminazione la stessa eco si riconosce (controllo)", 1, D.righeEco([{ direction: "outbound", created_at: "2026-10-30T09:00:00.000Z", body: "Va bene", to_number: NUM }, { direction: "inbound", canale: "manychat", created_at: "2026-10-30T09:00:10.000Z", body: "Va bene", from_number: NUM }]).size);

  gruppo("PONTE WHATSAPP · REVOCHE · LE LETTURE (useChatWa, hook dell'attesa) E I COMPONENTI NON TOCCATI");
  const letture = readFileSync(join(radice, "src/crm/chatwa/useChatWa.ts"), "utf8");
  const tipi = readFileSync(join(radice, "src/crm/chatwa/tipi.ts"), "utf8");
  const hook = readFileSync(join(radice, "src/routes/hooks/attesa-da-chiamare.ts"), "utf8");
  c("WaMessageRow porta eliminato_il (facoltativo: prima della migrazione manca)", true, /eliminato_il\?: string \| null;/.test(tipi));
  c("useChatWa: la colonna si legge (COLONNE_MSG) e i due filtri sul database sono quelli dei doppioni + eliminato_il", [true, 2], [/COLONNE_MSG =[\s\S]{0,260}eliminato_il/.test(letture), (letture.match(/q\.is\("duplicato_di", null\)\.is\("eliminato_il", null\)/g) ?? []).length]);
  c("useChatWa: la lettura a pezzi NON filtra (la riga eliminata deve arrivare per toglierla dalla pagina)", true, /\.gte\("cambiato_il", curM as string\)/.test(letture) && !/gte\("cambiato_il"[\s\S]{0,120}eliminato_il/.test(letture));
  c("useChatWa: una riga eliminata esce anche dalla chat aperta (come un doppione marcato dopo)", true, /righeM\.filter\(\(x\) => x\.duplicato_di \|\| x\.eliminato_il\)/.test(letture));
  c("hook dell'attesa: legge le sole uscite non eliminate, e senza la colonna ripiega", [true, true], [/\.is\("eliminato_il", null\)/.test(hook), /42703/.test(hook)]);
  //  Componenti: nessuno dei tre che hanno rami aperti in un'altra sessione si tocca.
  const toccati = ["RigaChat.tsx", "ElencoChat.tsx", "Casella.tsx"].filter((f) => /eliminato_il/.test(readFileSync(join(radice, "src/crm/chatwa", f), "utf8")));
  c("RigaChat.tsx, ElencoChat.tsx e Casella.tsx non nominano eliminato_il (si filtra nelle letture e nei tipi)", [], toccati);
}
