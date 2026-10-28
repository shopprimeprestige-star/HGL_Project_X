/** ── PROVE: CHAT WHATSAPP · «DI RITORNO» CON LO STATO DI PRIMA ───────────────
 *
 *  Commessa 2026-10-28-chat-ritorno-e-link. La regola pura di
 *  `src/crm/chatwa/ritorno.ts`: il distintivo corto della riga, quello completo
 *  del dettaglio (con lo stato che il lead aveva quando è ricomparso) e la
 *  frase del tooltip con la data dell'ultimo ritorno. Più i controlli sul
 *  sorgente: riga, intestazione e Info lo usano davvero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveChatRitorno(mod, { c, gruppo, radice }) {
  const R = mod["chatwa/ritorno"];
  const ric = (x) => ({ stato: "da_contattare", ricarico: { volte: 1, ultimo: "2026-10-12T10:00:00Z", ...x } });

  gruppo("CHAT · RITORNO · QUANDO C'È");
  c("una scheda normale: niente", null, R.ritornoInChat({ stato: "da_contattare" }));
  c("niente dati: niente", null, R.ritornoInChat(null));
  c("un ricarico illeggibile (volte 0): niente", null, R.ritornoInChat({ ricarico: { volte: 0 } }));

  gruppo("CHAT · RITORNO · CON LO STATO DI PRIMA");
  const una = R.ritornoInChat(ric({ statoAllora: "appuntamento_fissato" }));
  c("nella riga: solo «↩ Ritorno»", "↩ Ritorno", una.corta);
  c("nel dettaglio: stato di prima completo", "↩ Di ritorno · prima: Appuntamento fissato", una.completa);
  c("lo stato di prima, in chiaro", "Appuntamento fissato", una.prima);
  c("una volta sola: niente «×»", false, una.completa.includes("×"));
  c("il tooltip ha la data dell'ultimo ritorno", true, una.titolo.includes("12/10/2026"));
  c("…e lo stato di prima", true, una.titolo.includes("Appuntamento fissato"));

  gruppo("CHAT · RITORNO · PIÙ VOLTE");
  const tre = R.ritornoInChat(ric({ volte: 3, statoAllora: "non_risponde" }));
  c("«×3» nel dettaglio", "↩ Di ritorno ×3 · prima: Non risponde", tre.completa);
  c("la riga resta corta anche alla terza", "↩ Ritorno", tre.corta);
  c("il tooltip dice quante volte", true, /3 volte/.test(tre.titolo));
  c("le volte", 3, tre.volte);

  gruppo("CHAT · RITORNO · SENZA LO STATO DI PRIMA");
  const senza = R.ritornoInChat(ric({}));
  c("non inventa uno stato: solo «Di ritorno»", "↩ Di ritorno", senza.completa);
  c("prima: niente", null, senza.prima);
  c("il tooltip non parla di prima", false, /prima/i.test(senza.titolo));
  c("uno stato sconosciuto vale come assente", "↩ Di ritorno ×2",
    R.ritornoInChat(ric({ volte: 2, statoAllora: "stato_inventato" })).completa);
  c("una data illeggibile non entra nel tooltip", false,
    /Invalid|NaN/.test(R.ritornoInChat(ric({ ultimo: "boh" })).titolo));

  gruppo("CHAT · RITORNO · DOVE SI VEDE");
  const leggi = (f) => readFileSync(join(radice, "src/crm/chatwa", f), "utf8");
  c("la riga mostra la versione corta", true, /ritornoInChat\(/.test(leggi("RigaChat.tsx")) && /\.corta/.test(leggi("RigaChat.tsx")));
  c("l'intestazione della chat mostra quella completa", true, /\.completa/.test(leggi("Conversazione.tsx")));
  c("Info lo racconta con la data (sul telefono non c'è il tooltip)", true, /ritornoInChat\(/.test(leggi("InfoModulo.tsx")) && /\.titolo/.test(leggi("InfoModulo.tsx")));
}
