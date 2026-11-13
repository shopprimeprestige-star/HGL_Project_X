/** ── FATTURE DALLA CHAT · T0 · LE FONDAMENTA ────────────────────────────────
 *  (a) i moduli puri del §2 del piano esistono e sono impacchettati; (b) le
 *  chiavi `chat_fatture_*` non toccano la numerazione (`fattura:`/`fattura_bozza:`)
 *  né la famiglia della bulk (`bulk_fatture_*`); (c) `schedaIdValido`/`idRigaValido`
 *  accettano solo un UUID vero; (d) ogni costruttore di chiave lancia PRIMA di
 *  costruire qualunque stringa quando `lotto`/`idRiga`/`schedaId` non sono validi
 *  — stessa disciplina di `sicuro(lotto)` nella bulk (PIANO §0.1 punto 4, revisione
 *  del revisore punto 4). ⚠️ Dati inventati (prove/fatture-dalla-chat/dati.mjs). */
import { ID_NON_VALIDI, LOTTO_PROVA, SCHEDA_PROVA, SCHEDA_PROVA_ALTRA } from "./dati.mjs";

/** Lo stesso LIKE di Postgres di prove/fatture-bulk/fondamenta.mjs: si rifà qui
 *  apposta per provarlo, non per usarlo (nessuna dipendenza fra le due cartelle). */
function comeLike(prefisso, { proteggi }) {
  const p = proteggi ? prefisso.replace(/[\\%_]/g, (ch) => `\\${ch}`) : prefisso;
  const lett = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "\\") re += lett(p[++i] ?? "");
    else if (ch === "%") re += ".*";
    else if (ch === "_") re += ".";
    else re += lett(ch);
  }
  return new RegExp(`^${re}.*$`);
}

export async function prove(mod, { c, gruppo }) {
  const K = mod["fatture/dalla-chat/chiavi"];
  const L = LOTTO_PROVA;

  gruppo("DALLA CHAT · T0 · I MODULI ESISTONO");
  const attesi = ["tipi", "chiavi"];
  c(
    "i moduli puri del §2 sono impacchettati",
    attesi.map(() => "object"),
    attesi.map((m) => typeof mod[`fatture/dalla-chat/${m}`]),
  );

  gruppo("DALLA CHAT · T0 · LE CHIAVI NON ENTRANO NELLA NUMERAZIONE");
  const chiavi = [
    K.chiaveTestata(L),
    K.chiaveRiga(L, SCHEDA_PROVA),
    K.chiavePagamento(L, SCHEDA_PROVA),
    K.chiaveReclamo(L, SCHEDA_PROVA),
    K.chiaveEmittente(L),
  ];
  c(
    "la forma di ogni chiave",
    [
      `chat_fatture_t:${L}`,
      `chat_fatture_r:${L}:${SCHEDA_PROVA}`,
      `chat_fatture_p:${L}:${SCHEDA_PROVA}`,
      `chat_fatture_c:${L}:${SCHEDA_PROVA}`,
      `chat_fatture_e:${L}`,
    ],
    chiavi,
  );
  c(
    "nessuna chiave inizia con «fattura»",
    [],
    chiavi.filter((k) => k.startsWith("fattura")),
  );
  // Entrambi i modi di leggerli: protetti (come fa archivio.ts) e NON protetti (il caso del jolly `_`).
  for (const prefisso of ["fattura:", "fattura_bozza:", "fattura_azienda", "bulk_fatture_"])
    for (const proteggi of [true, false])
      c(
        `nessuna chiave rientra nel LIKE «${prefisso}%» (${proteggi ? "con" : "senza"} escape di «_»)`,
        [],
        chiavi.filter((k) => comeLike(prefisso, { proteggi }).test(k)),
      );
  c(
    "ogni chiave inizia per «chat_fatture_»",
    true,
    chiavi.every((k) => k.startsWith("chat_fatture_")),
  );
  const campioni = [
    K.chiaveRiga(L, SCHEDA_PROVA),
    K.chiavePagamento(L, SCHEDA_PROVA),
    K.chiaveReclamo(L, SCHEDA_PROVA),
  ];
  c(
    "ogni prefisso pesca solo la sua famiglia (righe, pagamento, reclami)",
    [
      [true, false, false],
      [false, true, false],
      [false, false, true],
    ],
    [K.prefissoRighe(L), K.prefissoPagamento(L), K.prefissoReclami(L)].map((p) =>
      campioni.map((k) => comeLike(p, { proteggi: true }).test(k)),
    ),
  );
  c(
    "un lotto non pesca le righe di un altro con l'id che inizia uguale",
    false,
    comeLike(K.prefissoRighe("lotto-0123abcd"), { proteggi: true }).test(
      K.chiaveRiga("lotto-0123abcdef", SCHEDA_PROVA),
    ),
  );

  gruppo("DALLA CHAT · T0 · schedaIdValido / idRigaValido");
  c(
    "un UUID vero è valido (entrambe le funzioni, è lo stesso formato)",
    [true, true],
    [K.schedaIdValido(SCHEDA_PROVA), K.idRigaValido(SCHEDA_PROVA)],
  );
  c("un secondo UUID vero, diverso, è valido", true, K.schedaIdValido(SCHEDA_PROVA_ALTRA));
  c(
    "ogni forma non valida (vuota, con «:», «%», «_» al posto dei trattini, troncata, un percorso, spazi) è rifiutata",
    ID_NON_VALIDI.map(() => false),
    ID_NON_VALIDI.map((id) => K.schedaIdValido(id)),
  );
  c(
    "idRigaValido rifiuta le stesse forme (stesso formato di schedaIdValido: idRiga = schedaId)",
    ID_NON_VALIDI.map(() => false),
    ID_NON_VALIDI.map((id) => K.idRigaValido(id)),
  );

  gruppo("DALLA CHAT · T0 · OGNI COSTRUTTORE DI CHIAVE VALIDA PRIMA DI COSTRUIRE");
  const costruttoriConIdRiga = [
    ["chiaveRiga", (id) => K.chiaveRiga(L, id)],
    ["chiavePagamento", (id) => K.chiavePagamento(L, id)],
    ["chiaveReclamo", (id) => K.chiaveReclamo(L, id)],
  ];
  for (const [nome, costruisci] of costruttoriConIdRiga) {
    c(
      `${nome}: un idRiga non valido lancia sempre, prima di toccare qualunque stringa`,
      ID_NON_VALIDI.map(() => true),
      ID_NON_VALIDI.map((id) => {
        try {
          costruisci(id);
          return false;
        } catch {
          return true;
        }
      }),
    );
  }
  const costruttoriConLotto = [
    ["chiaveTestata", (lotto) => K.chiaveTestata(lotto)],
    ["chiaveEmittente", (lotto) => K.chiaveEmittente(lotto)],
    ["chiaveRiga", (lotto) => K.chiaveRiga(lotto, SCHEDA_PROVA)],
  ];
  for (const [nome, costruisci] of costruttoriConLotto) {
    c(
      `${nome}: un lotto non valido (es. con «:» o «%») lancia`,
      [true, true],
      [
        (() => {
          try {
            costruisci("a:b");
            return false;
          } catch {
            return true;
          }
        })(),
        (() => {
          try {
            costruisci("a%");
            return false;
          } catch {
            return true;
          }
        })(),
      ],
    );
  }

  gruppo("DALLA CHAT · T0 · LE COSTANTI DEL PIANO (§2)");
  c(
    "MAX_CLIENTI, MAX_IMMAGINI_CHAT, MAX_MESSAGGI_TESTO, MAX_CARATTERI_TESTO",
    { MAX_CLIENTI: 100, MAX_IMMAGINI_CHAT: 8, MAX_MESSAGGI_TESTO: 300, MAX_CARATTERI_TESTO: 6000 },
    {
      MAX_CLIENTI: K.MAX_CLIENTI,
      MAX_IMMAGINI_CHAT: K.MAX_IMMAGINI_CHAT,
      MAX_MESSAGGI_TESTO: K.MAX_MESSAGGI_TESTO,
      MAX_CARATTERI_TESTO: K.MAX_CARATTERI_TESTO,
    },
  );

  gruppo("DALLA CHAT · T0 · CARTELLA DEL BUCKET");
  c(
    "cartella del bucket: <utente>/chat/<lotto>/",
    "u1/chat/lotto-0123abcd/",
    K.cartellaBucket("u1", L),
  );
}
