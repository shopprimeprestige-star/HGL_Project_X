/** ── PROVE: IL MONDO FINTO DELLA PRENOTAZIONE IN CHAT ─────────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), compito T7 (PIANO.md, rev. 11). Non
 *  è una prova: è il «mondo» in cui girano `prenota.mjs` (T7) e
 *  `prenota-concorrenza.mjs` (T9). Un database finto in memoria con le stesse
 *  regole di quello vero che contano per la prenotazione, e un OROLOGIO FINTO.
 *
 *  Cosa fa il mondo (e perché somiglia al vero):
 *   · `m.righe` è `app_config`: una Map chiave → testo. Dentro ci stanno TUTTE
 *     le righe che la funzione scrive (proposta e contatore, lucchetti, stanza,
 *     fascia, attesi): così un confronto di `m.righe` prima e dopo vede anche
 *     le righe orfane. La riga di configurazione è a parte (`m.cfg`).
 *   · `m.schede` sono le schede (`Lead`). `scriviScheda` è condizionata a
 *     `updated_at` e lo fa avanzare a ogni scrittura (come il trigger del
 *     database): zero righe = «cambiata». Lo fa avanzare anche
 *     `scriviContatto` (la funzione SQL fa un UPDATE). Le letture danno COPIE,
 *     mai la scheda viva.
 *   · I lucchetti sono un INSERT che riesce solo se la riga non c'è, o è
 *     scaduta secondo l'OROLOGIO FINTO (`m.ora`, `m.avanza(ms)`); `lascia`
 *     toglie la riga solo se il `di` è il proprio.
 *   · Ogni porta è ATOMICA (dopo l'attesa, il corpo non cede il turno): per
 *     intrecciare due richieste (T9) si usa il gancio `m.prima(nome, n)`,
 *     chiamato e atteso all'ingresso di ogni porta: lì si cede il turno.
 *   · I guasti sono a comando: `m.guasto = { al: N, dopo?, fisso? }` rompe la
 *     N-esima chiamata a una porta (`dopo`: l'operazione riesce e poi lancia,
 *     come una risposta persa; `fisso`: da N in poi rompe tutto). L'errore
 *     porta dentro numero e parole del cliente: la logica non deve farli
 *     uscire (`avvisi`, risposte).
 *   · `m.chiamate` (i nomi delle porte chiamate, in ordine) e `m.scritture`
 *     (quelle che hanno scritto davvero) servono a dire «zero letture», «zero
 *     scritture».
 *
 *  Dati inventati: nessun numero né nome vero. `mod`: i moduli impacchettati
 *  da `prove/prove.mjs`.
 *  ───────────────────────────────────────────────────────────────────────── */

/** martedì 27/10/2026, 14:00 a Roma (ora solare dal 25/10) */
export const ADESSO = new Date("2026-10-27T13:00:00Z");
export const TOKEN = "t".repeat(64);
export const UTENTE = "u-1";
/** il numero del lead di prova, come lo tiene il registro */
export const TEL = "393331234567";
/** uuid veri: `crm_lead_id` si accetta solo così */
export const ID = (n) => `aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, "0")}`;

/** I dati che il testo non deve mai far uscire (cognome, note, altri clienti…). */
export const SENSIBILI = {
  cognome: "Rossetti",
  nota: "nota riservata del lead",
  telefono: "333 123 4567",
  altroCliente: "Giuseppina Bianchini",
  email: "anna.prova@example.org",
};

const SETTIMANA = [1, 2, 3, 4, 5];

/** Un consulente che lavora dal lunedì al venerdì, 09-13 e 14-19 (ore piene). */
export function consulente(id, nome, extra = {}, fasce) {
  return {
    id,
    user_id: UTENTE,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    data: {
      nome,
      giorniLavorativi: SETTIMANA,
      fasceOrarie: fasce ?? [
        { inizio: "09:00", fine: "13:00" },
        { inizio: "14:00", fine: "19:00" },
      ],
      attivo: true,
      ...extra,
    },
  };
}
export const FIL = () => consulente("c-fil", "Filippo", { priorita: 3 });
export const BEA = () => consulente("c-bea", "Bea", { priorita: 1 });
export const CARLO = () => consulente("c-carlo", "Carlo", { priorita: 2 });

/** Una scheda (lead) «da contattare» con il numero di prova. */
export function lead(id, dati = {}, extra = {}) {
  return {
    id,
    user_id: UTENTE,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-20T10:00:00.000Z",
    data: {
      nome: "Anna",
      cognome: SENSIBILI.cognome,
      telefono: SENSIBILI.telefono,
      email: SENSIBILI.email,
      note: SENSIBILI.nota,
      stato: "da_contattare",
      ...dati,
    },
    ...extra,
  };
}

/** Una consulenza fissata di un altro cliente (occupa lo slot). */
export function consulenza(id, consulenteId, giorno, ora, dati = {}) {
  return lead(
    id,
    {
      nome: "Giuseppina",
      cognome: "Bianchini",
      telefono: "340 000 0000",
      stato: "appuntamento_fissato",
      consulenteId,
      dataMeeting: giorno,
      oraMeeting: ora,
      durataMeeting: 60,
      ...dati,
    },
    {},
  );
}

/** Il corpo di una richiesta, già letto (come lo dà `leggiCorpoPrenota`). */
export const corpoTesto = (testo, o = {}) => ({
  azione: "testo",
  crmLeadId: "",
  telefono: `+${TEL}`,
  testo,
  scelta: 0,
  ...o,
});
export const corpoScelta = (n, o = {}) => ({
  azione: "scelta",
  crmLeadId: "",
  telefono: `+${TEL}`,
  testo: "",
  scelta: n,
  ...o,
});

const copia = (x) => (x === undefined ? undefined : structuredClone(x));

export function creaMondo(mod, opz = {}) {
  const RT = mod["manychat/ritorno"];
  const CT = mod["manychat/contatto"];

  const m = {
    ora: new Date(opz.ora ?? ADESSO),
    cfg:
      opz.cfg === undefined
        ? { acceso: true, consulenteId: "", preavvisoOre: 3, giorniAvanti: 14, durataMin: 60 }
        : opz.cfg,
    utente: opz.utente ?? { userId: UTENTE },
    //  ⚠️ Copie: chi passa le stesse opzioni a più mondi (un giro per guasto)
    //  non deve vedere la scheda prenotata dal giro prima.
    consulenti: copia(opz.consulenti) ?? [FIL(), BEA()],
    schede: copia(opz.schede) ?? [lead(ID(1))],
    blocchi: copia(opz.blocchi) ?? [],
    righe: new Map(Object.entries(copia(opz.righe) ?? {})),
    nonScrivere: new Set(opz.nonScrivere ?? []),
    chiamate: [],
    scritture: [],
    avvisi: [],
    attese: [],
    passi: 0,
    versione: 0,
    /** gancio asincrono all'ingresso di ogni porta: `async (nome, n) => {}` */
    prima: null,
    /** `{ al, dopo?, fisso? }` */
    guasto: null,
  };

  m.avanza = (ms) => {
    m.ora = new Date(m.ora.getTime() + ms);
  };
  const adesso = () => new Date(m.ora);
  const errore = () => ({ code: "XX000", message: `dato ${TEL} ${SENSIBILI.cognome} e parole` });
  const bump = (s) => {
    m.versione++;
    s.updated_at = new Date(Date.parse("2026-10-27T00:00:00.000Z") + m.versione * 1000).toISOString();
  };
  const scrive = (porta, chiave) => m.scritture.push({ porta, chiave });

  /** Una porta: conta la chiamata, cede il turno al gancio, può rompersi. */
  const op =
    (nome, fn) =>
    async (...a) => {
      m.chiamate.push(nome);
      const n = ++m.passi;
      if (m.prima) await m.prima(nome, n);
      const g = m.guasto;
      const rotto = !!g && (g.fisso ? n >= g.al : n === g.al);
      if (rotto && !g.dopo) throw errore();
      const r = await fn(...a);
      if (rotto && g.dopo) throw errore();
      return r;
    };

  const viva = (userId, id) => m.schede.find((s) => s.id === id && s.user_id === userId);
  const nellIntervallo = (d, dal, al) => {
    const dentro = (g) => typeof g === "string" && g >= dal && g <= al;
    return (
      dentro(d.dataMeeting) ||
      dentro(d.dataVieneInSede) ||
      dentro(d.installazione?.dataInstallazione) ||
      (d.manutenzione?.appuntamenti ?? []).some((x) => x.stato === "fissata")
    );
  };

  m.porte = {
    adesso,
    avviso: (codice) => m.avvisi.push(codice),
    config: op("config", async () => copia(m.cfg)),
    utente: op("utente", async () => copia(m.utente)),
    consulenti: op("consulenti", async (userId) =>
      copia(m.consulenti.filter((c) => c.user_id === userId)),
    ),
    schedeAgenda: op("schedeAgenda", async (userId, dal, al) =>
      copia(m.schede.filter((s) => s.user_id === userId && nellIntervallo(s.data, dal, al))),
    ),
    blocchi: op("blocchi", async () => copia(m.blocchi)),
    schedeDelNumero: op("schedeDelNumero", async (userId, tel) =>
      copia(
        m.schede.filter(
          (s) => s.user_id === userId && RT.cifreTelefono(s.data.telefono) === tel,
        ),
      ),
    ),
    scheda: op("scheda", async (userId, id) => copia(viva(userId, id)) ?? null),
    scriviScheda: op("scriviScheda", async (userId, id, vistoIl, data) => {
      const s = viva(userId, id);
      if (!s || s.updated_at !== vistoIl) return "cambiata";
      s.data = copia(data);
      bump(s);
      scrive("scriviScheda", id);
      return "ok";
    }),
    proposta: op("proposta", async (chiave) => {
      const g = m.righe.get(chiave);
      return g ? JSON.parse(g) : null;
    }),
    scriviProposta: op("scriviProposta", async (chiave, riga) => {
      m.righe.set(chiave, JSON.stringify(riga));
      scrive("scriviProposta", chiave);
    }),
    lucchetto: {
      prendi: op("lucchetto.prendi", async (chiave, di, scadeMs) => {
        const g = m.righe.get(chiave);
        if (g && Date.parse(JSON.parse(g).fino) > m.ora.getTime()) return false;
        m.righe.set(
          chiave,
          JSON.stringify({ di, fino: new Date(m.ora.getTime() + scadeMs).toISOString() }),
        );
        scrive("lucchetto.prendi", chiave);
        return true;
      }),
      lascia: op("lucchetto.lascia", async (chiave, di) => {
        const g = m.righe.get(chiave);
        if (g && JSON.parse(g).di === di) {
          m.righe.delete(chiave);
          scrive("lucchetto.lascia", chiave);
        }
      }),
    },
    stanza: {
      leggi: op("stanza.leggi", async (chiave) => m.righe.get(chiave) ?? null),
      scrivi: op("stanza.scrivi", async (chiave, valore) => {
        m.righe.set(chiave, valore);
        scrive("stanza.scrivi", chiave);
      }),
      elimina: op("stanza.elimina", async (chiave) => {
        m.righe.delete(chiave);
        scrive("stanza.elimina", chiave);
      }),
    },
    statoSecondo: op("statoSecondo", async (userId, id) => {
      const s = viva(userId, id);
      return s ? { contattoWa: copia(s.data.contattoWa) } : null;
    }),
    //  `contatto_wa_aggiorna`: la guardia dello STOP appiccicoso, e l'UPDATE
    //  fa avanzare `updated_at` come per ogni scrittura sulla scheda.
    scriviContatto: op("scriviContatto", async (userId, id, cambio) => {
      const s = viva(userId, id);
      if (!s) return false;
      if (s.data.contattoWa?.stato === "stop" && cambio.patch.da === "automatico") return false;
      s.data.contattoWa = CT.applicaCambio(s.data.contattoWa, cambio);
      bump(s);
      scrive("scriviContatto", id);
      return true;
    }),
    nonScrivere: op("nonScrivere", async (_userId, tel) => m.nonScrivere.has(tel)),
    attesa: async (ms) => {
      m.attese.push(ms);
      m.avanza(ms);
    },
  };

  /** La richiesta come la darebbe la rotta, già con la chiave giusta. */
  m.richiesta = (corpo = corpoTesto("sera"), extra = {}) => ({
    chiaveOk: true,
    segretoPresente: true,
    segreto: TOKEN,
    corpo,
    adesso: adesso(),
    ...extra,
  });
  /** La scheda com'è adesso (copia). */
  m.scheda = (id) => copia(m.schede.find((s) => s.id === id));
  /** La setter che salva dal browser: scrittura diretta, SENZA lucchetto. */
  m.setter = (id, patch) => {
    const s = m.schede.find((x) => x.id === id);
    s.data = { ...s.data, ...copia(patch) };
    bump(s);
  };
  /** Un'altra scheda che compare nell'agenda (una consulenza fissata). */
  m.aggiungi = (scheda) => {
    m.schede.push(scheda);
  };
  m.riga = (chiave) => (m.righe.has(chiave) ? JSON.parse(m.righe.get(chiave)) : null);
  m.chiavi = (prefisso) => [...m.righe.keys()].filter((k) => k.startsWith(prefisso)).sort();
  m.lucchetti = () => m.chiavi("prenota_chat_lock:");
  /** La chiave della riga di proposta del numero di prova. */
  m.chiaveProposta = async (tel = TEL) =>
    mod["manychat/prenota-tipi"].prefissoProposta +
    (await mod["manychat/prenota-tipi"].improntaNumero(tel, TOKEN));
  /** Le scritture fatte da certe porte. */
  m.scrittureDi = (...porte) => m.scritture.filter((s) => porte.includes(s.porta));
  /** Tutto lo stato che conta, per un confronto profondo prima/dopo. */
  m.fotografia = () => ({
    schede: copia(m.schede),
    righe: [...m.righe.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  });
  /** Azzera i contatori (non lo stato), per misurare solo il passo dopo. */
  m.azzera = () => {
    m.chiamate = [];
    m.scritture = [];
    m.avvisi = [];
    m.attese = [];
    m.passi = 0;
  };
  return m;
}
