/** ── PROVE: L'ECO DI MANYCHAT NON È MAI UNA ENTRATA DEL CLIENTE (30/10/2026) ────────────────────
 *  Guasto del titolare (30/10 22:22): chat i cui ultimi messaggi sono tutti nostri restavano in
 *  «Da rispondere». Causa: ogni messaggio mandato dal telefono torna da ManyChat dopo pochi secondi
 *  come «entrata» (eco). La route aveva già scritto `ultimo_in_entrata_il` con l'ora dell'eco, e
 *  l'eco è DOPO il nostro ultimo messaggio. Poi l'eco veniva segnata `duplicato_di` (nascosta), ma il
 *  contatto restava sporco.
 *  I dati sono quelli veri del caso (orari del 28/10, numero e testi inventati): vedi
 *  commesse/2026-10-30-eco-manychat-entrata/LAVAGNA.md. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export async function proveEcoManychatEntrata(mod, { c, gruppo, radice }) {
  const S = mod["chatwa/stato"];
  const O = mod["chatwa/ordineWhatsapp"];
  const M = mod["chatwa/menuDaRispondere"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");

  const alle = (hhmmss) => `2026-10-28T${hhmmss}Z`;
  const ADESSO = Date.parse("2026-10-30T22:00:00Z");
  const dr = (contatto, extra = {}) => S.daRispondere({ contatto, messaggi: [], adesso: ADESSO, ...extra });

  /** Il contatto come lo ha lasciato il database: l'ultima entrata è l'ECO delle 18:00:04. */
  const sporco = (extra = {}) => ({
    phone_e164: "+39333000201",
    ultimo_in_entrata_il: alle("18:00:04"),
    ultimo_in_entrata_anteprima: "Va bene, grazie",
    ultimo_messaggio_il: alle("17:59:56"),
    ultimo_messaggio_direzione: "outbound",
    last_message_at: alle("18:00:04"),
    risposto_il: null,
    unread_count: 0,
    ...extra,
  });

  gruppo("ECO DI MANYCHAT: NON RIPORTA LA CHAT IN «DA RISPONDERE»");
  c("il caso vero: ultimo nostro 17:59:56 (telefono), eco 18:00:04 come entrata: NON in attesa", false,
    dr(sporco()).attesa);
  c("…anche con l'ultimo messaggio letto in pagina (nostro, canale ponte) e senza colonne sul contatto", false,
    dr({ ultimo_in_entrata_il: alle("18:00:04"), ultimo_in_entrata_anteprima: "Va bene, grazie" },
      { ultimo: { direction: "outbound", created_at: alle("17:59:56"), status: null } }).attesa);
  c("eco a 2 secondi dal nostro messaggio (17:45:49 → 17:45:51)", false,
    dr(sporco({ ultimo_messaggio_il: alle("17:45:49"), ultimo_in_entrata_il: alle("17:45:51") })).attesa);
  c("eco a 21 secondi (17:56:18 → 17:56:39)", false,
    dr(sporco({ ultimo_messaggio_il: alle("17:56:18"), ultimo_in_entrata_il: alle("17:56:39") })).attesa);
  c("la stessa chat com'è oggi per il menu (solo colonne del contatto): NON in attesa", 0,
    S.contaDaRispondere([sporco()], ADESSO));

  gruppo("ECO DI MANYCHAT: I CASI VERI RESTANO IN ATTESA");
  c("ultimo messaggio del cliente (entrata vera dopo il nostro): in attesa, col suo orario",
    [true, alle("18:03:10")],
    ((r) => [r.attesa, r.dal])(dr(sporco({ ultimo_messaggio_il: alle("18:03:09"), ultimo_messaggio_direzione: "inbound", ultimo_in_entrata_il: alle("18:03:10") }))));
  c("nostro messaggio NON partito (failed) letto in pagina, poi un'entrata: il cliente aspetta", true,
    dr({ ultimo_in_entrata_il: alle("18:00:04") },
      { ultimo: { direction: "outbound", created_at: alle("17:59:56"), status: "failed" } }).attesa);
  c("il cliente risponde «Sera» 1 minuto dopo il nostro messaggio: è lui l'ultimo messaggio, resta in attesa", [true, alle("18:00:56")],
    ((r) => [r.attesa, r.dal])(dr(sporco({ ultimo_messaggio_il: alle("18:00:55"), ultimo_messaggio_direzione: "inbound", ultimo_in_entrata_il: alle("18:00:56"), ultimo_in_entrata_anteprima: "Sera" }))));
  c("«Sera» a 5 secondi dal nostro messaggio, ultimo messaggio del contatto già suo: in attesa", true,
    dr(sporco({ ultimo_messaggio_il: alle("17:59:59"), ultimo_messaggio_direzione: "inbound", ultimo_in_entrata_il: alle("18:00:01"), ultimo_in_entrata_anteprima: "Sera" })).attesa);
  c("«Sera» 61 secondi dopo il nostro messaggio (contatto non ancora aggiornato): oltre la finestra dell'eco, in attesa", true,
    dr(sporco({ ultimo_in_entrata_il: alle("18:00:57"), ultimo_in_entrata_anteprima: "Sera" })).attesa);
  c("eco con lo stesso vecchio testo 8 secondi dopo: fuori", false,
    dr(sporco({ ultimo_in_entrata_il: alle("18:00:04"), ultimo_in_entrata_anteprima: "Va bene, grazie" })).attesa);
  c("entrata molto dopo il nostro messaggio (ore): non è un'eco, resta in attesa", true,
    dr(sporco({ ultimo_in_entrata_il: alle("21:30:00") })).attesa);
  c("nostro messaggio PRIMA dell'entrata di 1 ora (regola vecchia): resta in attesa", true,
    dr(sporco({ ultimo_messaggio_il: alle("17:00:00"), ultimo_in_entrata_il: alle("18:00:04") })).attesa);
  c("senza le colonne del contatto e senza messaggio letto: come prima, in attesa", true,
    dr({ ultimo_in_entrata_il: alle("18:00:04") }).attesa);

  gruppo("ECO DI MANYCHAT: IL NUMERETTO DEL MENU COINCIDE CON LA PAGINA");
  const righe = [
    sporco({ id: "a", phone_e164: "+39333000201" }),
    sporco({ id: "b", phone_e164: "+39333000202", ultimo_messaggio_il: alle("18:03:09"), ultimo_messaggio_direzione: "inbound", ultimo_in_entrata_il: alle("18:03:10") }),
    sporco({ id: "c", phone_e164: "+39333000203", ultimo_messaggio_il: alle("17:45:49"), ultimo_in_entrata_il: alle("17:45:51") }),
  ];
  const porte = {
    contatti: async (_colonne, da, a) => ({ data: righe.slice(da, a + 1), error: null }),
    fallitiDi: async () => [],
  };
  const nPagina = righe.filter((r) => dr(r).attesa).length;
  c("pagina: 1 in attesa (solo la «b»)", 1, nPagina);
  c("menu: lo stesso numero", nPagina, await M.contaDalDatabase(porte, new Date(ADESSO)));
  c("menu: se l'ultimo nostro messaggio era fallito, il cliente aspetta (come la pagina)", 3,
    await M.contaDalDatabase({ ...porte, fallitiDi: async () => [
      { to_number: "+39333000201", created_at: alle("17:59:56") },
      { to_number: "+39333000203", created_at: alle("17:45:49") },
    ] }, new Date(ADESSO)));

  gruppo("TUTTE COME WHATSAPP: L'ECO NON SPOSTA LA CHAT");
  const chat = (phone, contact, lastMessage = null) => ({ phone, lead: { data: {} }, lastMessage, contact });
  const vuotaSporca = chat("+39333000301", { ultimo_messaggio_il: null, last_message_at: alle("18:00:04"), ultimo_in_entrata_il: alle("18:00:04") });
  c("migrazione dell'ultimo messaggio applicata e nessun messaggio vero: va in fondo (zero), non all'ora dell'eco", 0,
    O.quandoUltimo(vuotaSporca));
  c("…e così non sale sopra una chat vera delle 18:00:00", ["+39333000302", "+39333000301"],
    O.ordinaComeWhatsapp([vuotaSporca, chat("+39333000302", { ultimo_messaggio_il: alle("18:00:00") })]).map((x) => x.phone));
  c("migrazione NON applicata (colonna assente): ripiega ancora su last_message_at", Date.parse(alle("18:00:04")),
    O.quandoUltimo(chat("+39333000303", { last_message_at: alle("18:00:04") })));
  c("la chat del caso (ultimo vero 17:59:56) sta sotto una delle 18:00:00 e sopra una delle 17:59:00",
    ["+39333000402", "+39333000201", "+39333000403"],
    O.ordinaComeWhatsapp([
      chat("+39333000403", { ultimo_messaggio_il: alle("17:59:00") }),
      chat("+39333000201", sporco()),
      chat("+39333000402", { ultimo_messaggio_il: alle("18:00:00") }),
    ]).map((x) => x.phone));
  const hook = leggi("src/crm/chatwa/costruisciChat.ts"); // l'elenco si costruisce qui (chat veloce)
  c("«Da rispondere» ordina con la stessa ora di «Tutte» (quandoUltimo), non con last_message_at né l'ultima entrata", [true, false],
    [/quandoUltimo\(/.test(hook), /const quando = \(x: ChatItem\)[\s\S]{0,400}ultimo_in_entrata_il/.test(hook)]);

  gruppo("ECO DI MANYCHAT: MIGRAZIONE SOLO AGGIUNTIVA");
  const nome = readdirSync(join(radice, "supabase/migrations")).find((f) => f.endsWith("_eco_entrata_contatti.sql"));
  c("la migrazione dell'eco c'è", true, !!nome);
  if (nome) {
    const sql = leggi(`supabase/migrations/${nome}`).replace(/^\s*--.*$/gm, "");
    c("non cancella né svuota niente (solo CREATE OR REPLACE, trigger e UPDATE del contatto)", false,
      /\b(DROP\s+(TABLE|COLUMN|FUNCTION)|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE[^;]*DROP)\b/i.test(sql));
    c("scatta quando un'entrata ManyChat viene segnata come doppione/eco (duplicato_di)", true,
      /AFTER UPDATE OF duplicato_di ON public\.whatsapp_messages/i.test(sql));
    c("una funzione che sbaglia non blocca la pulizia (EXCEPTION)", true, /EXCEPTION\s+WHEN OTHERS/i.test(sql));
    c("nessuno dal browser può chiamarla", true,
      /REVOKE ALL ON FUNCTION public\.wa_riallinea_entrata_eco\(uuid, boolean\) FROM PUBLIC, anon, authenticated/i.test(sql));
  }
}
