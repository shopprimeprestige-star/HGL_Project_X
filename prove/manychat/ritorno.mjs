/** ── PROVE: LA RISPOSTA CHE TORNA · CORPO, CHIAVE, ABBINAMENTO ─────────────────────────
 *
 *  Commessa 2026-10-23 (ManyChat), compito U2. Le funzioni pure di `ritorno.ts`:
 *  il corpo si legge davvero (8 KB, senza fidarsi di `Content-Length`), la
 *  chiave si confronta esatta, l'impronta è stabile, l'abbinamento ignora i
 *  contatti sbagliati. Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo }`. */
export async function proveRitorno(mod, { c, gruppo }) {
  const R = mod["manychat/ritorno"];
  gruppo("MANYCHAT · IL RITORNO: CORPO, CHIAVE, ABBINAMENTO");

  /** Uno stream a pezzi, che conta quanti pezzi sono stati davvero letti. */
  const aPezzi = (pezzi) => {
    const stato = { letti: 0, annullato: false };
    let i = 0;
    const stream = new ReadableStream({
      pull(controllo) {
        if (i >= pezzi.length) return controllo.close();
        stato.letti++;
        controllo.enqueue(pezzi[i++]);
      },
      cancel() {
        stato.annullato = true;
      },
    });
    return { stream, stato };
  };
  const byte = (n, lettera = "a") => new TextEncoder().encode(lettera.repeat(n));

  /* ── leggiCorpoLimitato ────────────────────────────────────────────────── */
  const piccolo = await R.leggiCorpoLimitato(aPezzi([byte(100)]).stream);
  c("corpo piccolo: letto intero", [100, false], [piccolo.testo.length, piccolo.troppoGrande]);

  const alLimite = await R.leggiCorpoLimitato(aPezzi([byte(8192)]).stream);
  c(
    "esattamente 8192 byte: ancora ammesso",
    [8192, false],
    [alLimite.testo.length, alLimite.troppoGrande],
  );

  //  9 KB in pezzi, e nessun Content-Length da nessuna parte: conta lo stream.
  const nove = aPezzi(Array.from({ length: 9 }, () => byte(1024)));
  const grande = await R.leggiCorpoLimitato(nove.stream);
  c("9 KB senza Content-Length: troppo grande", true, grande.troppoGrande);
  c("…e il testo non si porta dietro il contenuto", "", grande.testo);
  c(
    "…ci si ferma al pezzo che sfora (il 9º) e lo stream è annullato",
    [9, true],
    [nove.stato.letti, nove.stato.annullato],
  );

  //  Un flusso che non finirebbe mai: non si legge oltre il limite.
  let prodotti = 0;
  const infinito = new ReadableStream({
    pull(controllo) {
      prodotti++;
      controllo.enqueue(byte(4096));
    },
  });
  const lim = await R.leggiCorpoLimitato(infinito);
  c(
    "flusso senza fine: fermato, non si legge all'infinito",
    true,
    lim.troppoGrande && prodotti <= 4,
  );

  const nullo = await R.leggiCorpoLimitato(null);
  c("nessun corpo: vuoto, non grande", ["", false], [nullo.testo, nullo.troppoGrande]);

  //  Caratteri a due byte spezzati fra un pezzo e l'altro: si leggono interi.
  const accento = new TextEncoder().encode("sì, è così");
  const spezzato = await R.leggiCorpoLimitato(
    aPezzi([accento.slice(0, 2), accento.slice(2, 3), accento.slice(3)]).stream,
  );
  c("lettera accentata spezzata fra due pezzi", "sì, è così", spezzato.testo);

  const rotto = new ReadableStream({
    start(controllo) {
      controllo.error(new Error("rete caduta"));
    },
  });
  const guasto = await R.leggiCorpoLimitato(rotto);
  c(
    "flusso che si rompe: non lancia, corpo vuoto",
    ["", false],
    [guasto.testo, guasto.troppoGrande],
  );

  c("il limite è 8192 e il testo 2000", [8192, 2000], [R.MAX_CORPO_BYTE, R.MAX_TESTO]);

  /* ── stessaChiave ─────────────────────────────────────────────────────── */
  const t = "a".repeat(64);
  c("chiave uguale → true", true, R.stessaChiave(t, t));
  c("chiave sbagliata (un carattere) → false", false, R.stessaChiave(t, "a".repeat(63) + "b"));
  c("chiave più corta → false", false, R.stessaChiave("a".repeat(63), t));
  c("chiave più lunga → false", false, R.stessaChiave(t + "a", t));
  c("una è prefisso dell'altra → false", false, R.stessaChiave("abc", "abcd"));
  c("chiave mancante → false", false, R.stessaChiave(null, t));
  c("chiave non scritta sul server → false", false, R.stessaChiave(t, undefined));
  c("tutte e due vuote → false (vuoto non è mai uguale)", false, R.stessaChiave("", ""));
  c("tutte e due assenti → false", false, R.stessaChiave(null, undefined));
  c("accenti: stessa chiave → true", true, R.stessaChiave("chiàve", "chiàve"));
  c("spazio in coda: non è la stessa → false", false, R.stessaChiave(t + " ", t));

  /* ── leggiCorpo ──────────────────────────────────────────────────────── */
  const U1 = "11111111-2222-4333-8444-555555555555";
  const U2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const bello = R.leggiCorpo({
    crm_invio_id: U1,
    crm_lead_id: U2,
    subscriber_id: "1000001",
    telefono: " +393331234567 ",
    testo: "Sì, confermo",
  });
  c(
    "corpo completo → campi stringa, telefono ripulito",
    {
      crmInvioId: U1,
      crmLeadId: U2,
      subscriberId: "1000001",
      telefono: "+393331234567",
      testo: "Sì, confermo",
    },
    bello,
  );
  c(
    "numeri al posto delle stringhe → stringhe",
    ["1000001", "393331234567"],
    ((x) => [x.subscriberId, x.telefono])(
      R.leggiCorpo({ subscriber_id: 1000001, telefono: 393331234567 }),
    ),
  );
  c(
    "campi mancanti → stringhe vuote",
    { crmInvioId: "", crmLeadId: "", subscriberId: "", telefono: "", testo: "" },
    R.leggiCorpo({}),
  );
  c(
    "segnaposto non risolti di ManyChat ({{…}}) → vuoti, mai un id finto",
    ["", "", "", ""],
    ((x) => [x.crmInvioId, x.crmLeadId, x.subscriberId, x.telefono === "" ? "" : "no"])(
      R.leggiCorpo({
        crm_invio_id: "{{crm_invio_id}}",
        crm_lead_id: "{{crm_lead_id}}",
        subscriber_id: "{{user_id}}",
        telefono: "",
      }),
    ),
  );
  c(
    "id che non è un uuid → vuoto (non arriva mai a una query)",
    "",
    R.leggiCorpo({ crm_invio_id: "1' or '1'='1" }).crmInvioId,
  );
  c(
    "subscriber_id con lettere o troppo lungo → vuoto",
    ["", ""],
    [
      R.leggiCorpo({ subscriber_id: "12ab" }).subscriberId,
      R.leggiCorpo({ subscriber_id: "1".repeat(25) }).subscriberId,
    ],
  );
  c(
    "testo oltre 2000 caratteri → tagliato a 2000",
    2000,
    R.leggiCorpo({ testo: "x".repeat(5000) }).testo.length,
  );
  c(
    "il taglio non spezza una emoji a metà",
    true,
    (() => {
      const x = R.leggiCorpo({ testo: "a".repeat(1999) + "😀" }).testo;
      return x === "a".repeat(1999);
    })(),
  );
  c(
    "il carattere nullo (che Postgres rifiuta) si toglie",
    "ab",
    R.leggiCorpo({ testo: "a\u0000b" }).testo,
  );
  c(
    "non è un oggetto → null",
    [null, null, null, null],
    [R.leggiCorpo(null), R.leggiCorpo("testo"), R.leggiCorpo(42), R.leggiCorpo([1, 2])],
  );
  c(
    "valori strani (oggetto, booleano) → vuoti, non lanciano",
    ["", ""],
    ((x) => [x.testo, x.telefono])(R.leggiCorpo({ testo: { a: 1 }, telefono: true })),
  );

  /* ── cifreTelefono ──────────────────────────────────────────────────── */
  c(
    "telefono → solo cifre, col prefisso",
    ["393331234567", "393331234567", "393331234567"],
    [
      R.cifreTelefono("+39 333 123 4567"),
      R.cifreTelefono("3331234567"),
      R.cifreTelefono("393331234567"),
    ],
  );
  c("numero straniero con il + → cifre", "447700900123", R.cifreTelefono("+44 7700 900123"));
  c(
    "vuoto o troppo corto → null",
    [null, null, null],
    [R.cifreTelefono(""), R.cifreTelefono("12"), R.cifreTelefono(undefined)],
  );

  /* ── impronta ───────────────────────────────────────────────────────── */
  const i1 = await R.impronta("1000001", "ok ci sono", "2026-10-23T15:09");
  const i2 = await R.impronta("1000001", "ok ci sono", "2026-10-23T15:09");
  c("impronta: stessa risposta → stessa impronta", i1, i2);
  c("…esadecimale di 32 caratteri", true, /^[0-9a-f]{32}$/.test(i1));
  c(
    "…cambia col testo, col contatto e col minuto",
    [false, false, false],
    [
      i1 === (await R.impronta("1000001", "ok ci sono!", "2026-10-23T15:09")),
      i1 === (await R.impronta("1000002", "ok ci sono", "2026-10-23T15:09")),
      i1 === (await R.impronta("1000001", "ok ci sono", "2026-10-23T15:10")),
    ],
  );
  c(
    "…i campi non si confondono ('ab'+'c' ≠ 'a'+'bc')",
    false,
    (await R.impronta("ab", "c", "m")) === (await R.impronta("a", "bc", "m")),
  );

  /* ── abbina ─────────────────────────────────────────────────────────── */
  const adesso = new Date("2026-10-23T15:10:00Z");
  const ore = (h) => new Date(adesso.getTime() - h * 3600e3).toISOString();
  const invio = (id, o = {}) => ({
    id,
    leadId: "lead-" + id,
    telefono: "393331234567",
    subscriberId: "1000001",
    prenotatoIl: ore(1),
    stato: "inviato",
    ...o,
  });
  const corpo = (o = {}) => ({
    crmInvioId: "",
    crmLeadId: "",
    subscriberId: "1000001",
    telefono: "+393331234567",
    testo: "ok",
    ...o,
  });
  const idDi = (r) => (r.tipo === "invio" ? r.invio.id : `${r.tipo}:${r.motivo}`);

  c("stesso subscriber_id → quell'invio", "a", idDi(R.abbina(corpo(), [invio("a")], adesso)));
  c(
    "più invii dello stesso contatto → l'ultimo",
    "b",
    idDi(
      R.abbina(
        corpo(),
        [invio("a", { prenotatoIl: ore(5) }), invio("b", { prenotatoIl: ore(1) })],
        adesso,
      ),
    ),
  );
  c(
    "con crm_invio_id giusto → proprio quello, anche se non è l'ultimo",
    "a",
    idDi(
      R.abbina(
        corpo({ crmInvioId: "a" }),
        [invio("a", { prenotatoIl: ore(5) }), invio("b", { prenotatoIl: ore(1) })],
        adesso,
      ),
    ),
  );
  c(
    "crm_invio_id di un ALTRO contatto → ignorata, anche se il telefono c'è",
    "ignorata:contatto_diverso",
    idDi(
      R.abbina(
        corpo({ crmInvioId: "x" }),
        [invio("x", { subscriberId: "2000002", telefono: "393339999999" }), invio("b")],
        adesso,
      ),
    ),
  );
  c(
    "crm_invio_id con altro telefono e senza subscriber nel corpo → ignorata",
    "ignorata:contatto_diverso",
    idDi(
      R.abbina(
        corpo({ crmInvioId: "x", subscriberId: "" }),
        [invio("x", { subscriberId: null, telefono: "393339999999" })],
        adesso,
      ),
    ),
  );
  c(
    "subscriber_id diverso, stesso telefono → ignorata (un altro contatto)",
    "ignorata:nessun_invio",
    idDi(R.abbina(corpo({ subscriberId: "7" }), [invio("a")], adesso)),
  );
  c(
    "senza subscriber_id: un invio a quel telefono di 6 giorni fa → abbinato",
    "a",
    idDi(R.abbina(corpo({ subscriberId: "" }), [invio("a", { prenotatoIl: ore(24 * 6) })], adesso)),
  );
  c(
    "…l'ultimo, non il primo della lista",
    "a",
    idDi(
      R.abbina(
        corpo({ subscriberId: "" }),
        [invio("b", { prenotatoIl: ore(48) }), invio("a", { prenotatoIl: ore(2) })],
        adesso,
      ),
    ),
  );
  c(
    "…il telefono si confronta nelle cifre (con +, spazi)",
    "a",
    idDi(R.abbina(corpo({ subscriberId: "", telefono: "+39 333 123 4567" }), [invio("a")], adesso)),
  );
  c(
    "invio con subscriber ancora vuoto ma stesso telefono → abbinato",
    "a",
    idDi(R.abbina(corpo(), [invio("a", { subscriberId: null })], adesso)),
  );
  c(
    "invio di 8 giorni fa → ignorata",
    "ignorata:nessun_invio",
    idDi(R.abbina(corpo(), [invio("a", { prenotatoIl: ore(24 * 8) })], adesso)),
  );
  c(
    "invio saltato o fallito (non è partito niente) → ignorata",
    "ignorata:nessun_invio",
    idDi(
      R.abbina(
        corpo(),
        [invio("a", { stato: "saltato" }), invio("b", { stato: "fallito" })],
        adesso,
      ),
    ),
  );
  c(
    "invio prenotato o incerto (forse è partito) → abbinato",
    "b",
    idDi(
      R.abbina(
        corpo(),
        [
          invio("a", { stato: "prenotato", prenotatoIl: ore(3) }),
          invio("b", { stato: "incerto", prenotatoIl: ore(1) }),
        ],
        adesso,
      ),
    ),
  );
  c("nessun invio → ignorata", "ignorata:nessun_invio", idDi(R.abbina(corpo(), [], adesso)));
  c(
    "né subscriber né telefono → ignorata",
    "ignorata:nessun_invio",
    idDi(R.abbina(corpo({ subscriberId: "", telefono: "" }), [invio("a")], adesso)),
  );
  c(
    "crm_invio_id inesistente (vecchio) → si cerca per contatto",
    "a",
    idDi(R.abbina(corpo({ crmInvioId: "non-c-e" }), [invio("a")], adesso)),
  );
}
