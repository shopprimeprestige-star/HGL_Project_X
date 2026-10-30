/** ── PROVE: LA VISTA «TUTTE», NELL'ORDINE DI WHATSAPP (30/10/2026) ─────────────
 *  Regole in src/crm/chatwa/ordineWhatsapp.ts: un elenco solo, dalla chat con l'ULTIMO messaggio
 *  (in entrata o in uscita, qualunque canale) più recente; i doppioni del ponte non contano.
 *  Il disegno (pastiglia «Tutte», nessuna sezione, 44 px, niente emoji) si prova sul sorgente.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveOrdineWhatsapp(mod, { c, gruppo, radice }) {
  const O = mod["chatwa/ordineWhatsapp"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  const alle = (hhmm, giorno = "2026-10-30") => `${giorno}T${hhmm}:00.000Z`;
  let n = 0;
  /** `o.ultimo`: il trigger del contatto; `o.letto`: l'ultimo messaggio letto in pagina. */
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333222${String(n).padStart(4, "0")}`,
      lead: o.senzaScheda ? null : { data: { stato: "da_contattare" } },
      lastMessage: o.letto
        ? { direction: o.dir ?? "inbound", body: "x", created_at: o.letto }
        : null,
      contact: {
        ultimo_messaggio_il: o.ultimo ?? null,
        ultimo_messaggio_direzione: o.dir ?? null,
        last_message_at: o.lma ?? null,
        ultimo_in_entrata_il: o.entrata ?? null,
      },
      unread: o.unread ?? 0,
      daRispondere: { attesa: o.attesa === true },
    };
  };
  const tel = (righe) => righe.map((r) => r.phone);

  gruppo("TUTTE COME WHATSAPP: QUANDO SI È MOSSA UNA CHAT");
  c("nessun messaggio: zero (va in fondo)", 0, O.quandoUltimo(chat()));
  c(
    "dal contatto: l'ora dell'ultimo messaggio",
    Date.parse(alle("10:00")),
    O.quandoUltimo(chat({ ultimo: alle("10:00") })),
  );
  c(
    "dal messaggio letto in pagina",
    Date.parse(alle("11:00")),
    O.quandoUltimo(chat({ letto: alle("11:00") })),
  );
  c(
    "il più recente fra messaggio letto e contatto",
    Date.parse(alle("12:00")),
    O.quandoUltimo(chat({ letto: alle("11:00"), ultimo: alle("12:00") })),
  );
  c(
    "un messaggio in USCITA conta come uno in entrata",
    Date.parse(alle("14:00")),
    O.quandoUltimo(chat({ dir: "outbound", ultimo: alle("14:00"), entrata: alle("09:00") })),
  );
  c(
    "un doppione del ponte spinge in avanti last_message_at: non conta se c'è l'ultimo messaggio vero",
    Date.parse(alle("10:00")),
    O.quandoUltimo(chat({ ultimo: alle("10:00"), lma: alle("10:05") })),
  );
  c(
    "senza l'ultimo messaggio, ripiega su last_message_at (chat vecchie, prima della migrazione)",
    Date.parse(alle("08:00")),
    O.quandoUltimo(chat({ lma: alle("08:00") })),
  );
  c(
    "…e sull'ultima entrata se manca anche quella",
    Date.parse(alle("07:00")),
    O.quandoUltimo(chat({ entrata: alle("07:00") })),
  );
  c("una data rotta vale zero, non rompe l'elenco", 0, O.quandoUltimo(chat({ ultimo: "boh" })));

  gruppo("TUTTE COME WHATSAPP: L'ORDINE");
  const vecchia = chat({ ultimo: alle("08:00", "2026-10-01") });
  const ieri = chat({ ultimo: alle("18:00", "2026-10-29"), dir: "outbound" });
  const oggiMattina = chat({ ultimo: alle("09:00"), unread: 3 });
  const oggiSera = chat({ letto: alle("17:30"), senzaScheda: true });
  const attesaVecchia = chat({ ultimo: alle("10:00", "2026-10-10"), attesa: true });
  const vuota = chat();
  const mischiate = [vecchia, vuota, ieri, oggiMattina, attesaVecchia, oggiSera];
  c(
    "dal più recente al più vecchio, chat vuote in fondo",
    tel([oggiSera, oggiMattina, ieri, attesaVecchia, vecchia, vuota]),
    tel(O.ordinaComeWhatsapp(mischiate)),
  );
  c(
    "gli sconosciuti (senza scheda) stanno nell'elenco, al loro posto",
    1,
    O.ordinaComeWhatsapp(mischiate).filter((x) => !x.lead).length,
  );
  c(
    "«da rispondere», non letti e stelle NON spostano nessuno: conta solo l'ora",
    tel([oggiSera, oggiMattina]),
    tel(O.ordinaComeWhatsapp(mischiate)).slice(0, 2),
  );
  c(
    "non muta l'ingresso",
    tel([vecchia, vuota, ieri, oggiMattina, attesaVecchia, oggiSera]),
    tel(mischiate),
  );
  const a = chat({ ultimo: alle("10:00") });
  const b = chat({ ultimo: alle("10:00") });
  c("a pari ora resta l'ordine di prima (stabile)", tel([a, b]), tel(O.ordinaComeWhatsapp([a, b])));
  c("a pari ora, anche a rovescio", tel([b, a]), tel(O.ordinaComeWhatsapp([b, a])));
  c("elenco vuoto: vuoto", [], O.ordinaComeWhatsapp([]));

  gruppo("TUTTE COME WHATSAPP: L'ORA A DESTRA");
  const F = mod["chatwa/formati"];
  const adesso = new Date(2026, 9, 30, 12, 0).getTime(); // venerdì 30/10/2026, mezzogiorno
  const ora = (g, m, gg, hh, mm) => F.formatOraWhatsapp(new Date(2026, m, gg, hh, mm), adesso);
  c("oggi: l'ora, «18:03»", "18:03", ora(0, 9, 30, 18, 3));
  c("oggi dopo mezzanotte: l'ora", "00:05", ora(0, 9, 30, 0, 5));
  c("ieri sera tardi: «Ieri» (conta il giorno, non le 24 ore)", "Ieri", ora(0, 9, 29, 23, 59));
  c("due giorni fa: il giorno della settimana", "mercoledì", ora(0, 9, 28, 9, 0));
  c("sei giorni fa: ancora il giorno della settimana", "sabato", ora(0, 9, 24, 9, 0));
  c("sette giorni fa: la data intera", "23/10/2026", ora(0, 9, 23, 9, 0));
  c(
    "un anno fa: la data intera",
    "30/10/2025",
    F.formatOraWhatsapp(new Date(2025, 9, 30, 9, 0), adesso),
  );
  c(
    "senza data o data rotta: niente",
    ["", ""],
    [F.formatOraWhatsapp(null, adesso), F.formatOraWhatsapp("boh", adesso)],
  );
  const riga = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  c(
    "la riga usa l'ora di WhatsApp solo con comeWhatsapp",
    true,
    /comeWhatsapp\s*\?\s*formatOraWhatsapp\(/.test(riga),
  );
  c(
    "in «Tutte» «Senza risposta» non prende il posto dell'ora",
    true,
    /a\.senzaRisposta && !comeWhatsapp/.test(riga),
  );
  c(
    "in «Tutte» l'ora non è ambra in grassetto",
    true,
    /modo === "attesa" && !comeWhatsapp/.test(riga),
  );
  c(
    "fuori da «Tutte» resta «da 5 min» (attesaInChiaro)",
    true,
    /\? attesaInChiaro\(dal, adesso\)/.test(riga),
  );
  c(
    "ElencoChat passa comeWhatsapp={tutte} a ogni riga",
    true,
    /comeWhatsapp=\{tutte\}/.test(senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"))),
  );

  gruppo("TUTTE COME WHATSAPP: IL DISEGNO");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  const src = senzaCommenti(elenco);
  const mod_ = senzaCommenti(leggi("src/crm/chatwa/ordineWhatsapp.ts"));
  c("ElencoChat usa ordinaComeWhatsapp", true, /ordinaComeWhatsapp\(/.test(src));
  c("c'è la pastiglia «Tutte»", true, />\s*Tutte\s*</.test(src) || /"Tutte"/.test(src));
  c(
    "«Tutte» è accesa quando nessuna coda è scelta (aria-pressed)",
    true,
    /filtri\.coda === null/.test(src) && /aria-pressed=\{tutte\}/.test(src),
  );
  c(
    "toccare «Tutte» toglie solo la coda: gli altri gruppi restano",
    true,
    /setFiltri\(\{ \.\.\.filtri, coda: null \}\)/.test(src),
  );
  c(
    "l'elenco «Tutte» è una lista sola, con il suo nome per chi usa lo screen reader",
    true,
    /<ul aria-label="Tutte le chat, dall'ultimo messaggio">/.test(src),
  );
  c(
    "la barra del prossimo meet sta ancora in cima",
    true,
    /BarraProssimoMeet/.test(src) &&
      src.indexOf("<BarraProssimoMeet") < src.indexOf("Tutte le chat, dall'ultimo messaggio"),
  );
  c(
    "in «Tutte» niente riquadro «Finestra in chiusura»: la condizione lo esclude",
    true,
    /filtri\.coda !== null && filtri\.finestra === "aperta"/.test(src),
  );
  c("le righe non vanno per stelle in «Tutte»", false, /tutte[^;]*perStelle/i.test(src));
  c("pastiglia a 44 px col dito (h-11)", true, /const PASTIGLIA =[\s\S]{0,200}h-11/.test(src));
  c("nessuna emoji nel disegno", false, /\p{Extended_Pictographic}/u.test(src + mod_));
  c(
    "il modulo dell'ordine è puro: niente React né Supabase",
    false,
    /from "react"|supabase/.test(mod_),
  );
}
