/** ── PROVE: LO STATO «ATTESA WHATSAPP» DOPO IL PRIMO MESSAGGIO ────────────────
 *
 *  Commessa 2026-10-28 (`wa-stato-dopo-primo`). Qui: le regole pure che il giro
 *  non deve perdere col cambio di stato (richiamo a 24 ore, primo contatto solo
 *  per «da contattare», nessun messaggio per stato), il TESTO della migrazione
 *  `20261028170000_manychat_attesa_whatsapp.sql` e dello script di recupero
 *  (non si lancia un Postgres: il comportamento del giro è in `giro.mjs`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  Martedì 27/10/2026 10:00 a Roma (+01:00, ora solare).
 *  `mod`: i moduli impacchettati. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

export async function proveStatoDopoPrimo(mod, { c, gruppo, radice }) {
  const S = mod["manychat/sequenze"];
  const T = mod["manychat/stati"];
  const t = (iso) => new Date(iso);
  const tel = (n) => `333 000 ${String(n).padStart(4, "0")}`;
  const t9 = (n) => `33000${String(n).padStart(4, "0")}`;
  const num = (n) => `39333000${String(n).padStart(4, "0")}`;
  const consulenti = [
    {
      id: "cons-1",
      data: { nome: "Filippo Demo", attivo: true, faConsulente: true, faSetter: false },
    },
  ];
  const TETTI = { ricontatti: 20, leadNuovi: 100, totale: 100 };
  const MAR10 = "2026-10-27T10:00:00+01:00";
  const decidi = (schede, invii = [], adesso = MAR10) =>
    S.decidiLeadNuovi(schede, t(adesso), {
      consulenti,
      invii,
      tetti: TETTI,
      fraseModuloDal: "2026-10-20T00:00:00.000Z",
      leadNuovoDal: "2026-10-20T06:00:00.000Z",
    });
  /** un lead del modulo Meta entrato ieri a mezzogiorno: ha il suo primo contatto di ieri */
  const modulo = (id, n, stato, extra) => ({
    id,
    data: {
      nome: "Anna",
      telefono: tel(n),
      stato,
      importato: true,
      consensoModulo: {
        whatsapp: true,
        il: "2026-10-26T11:00:00.000Z",
        via: "modulo_meta",
        fonte: "google_sheets",
      },
      origineIngresso: { via: "google_sheets", foglio: "Lead HGL", il: "2026-10-26T11:00:00.000Z" },
      ...extra,
    },
  });
  /** l'invio di ieri alle 10:30 Roma: oggi alle 10:00 sono 23,5 ore, il richiamo è dopo le 24 */
  const primoDi = (n, prenotatoIl) => ({
    telefono: num(n),
    tipo: "primo_contatto",
    stato: "inviato",
    prenotatoIl,
    chiave: `n|${t9(n)}`,
  });

  gruppo("MANYCHAT · ATTESA WHATSAPP · NIENTE SI PERDE COL CAMBIO DI STATO");
  {
    c(
      "STATI_LEAD_NUOVO: ora c'è anche «attesa_whatsapp»",
      //  «da_chiamare» (28/10/2026): ci arriva da solo dopo 10 ore di attesa.
      ["da_contattare", "non_risponde", "segreteria", "attesa_whatsapp", "da_chiamare"],
      S.STATI_LEAD_NUOVO,
    );

    //  il richiamo a 24 ore
    const adesso = "2026-10-27T12:00:00+01:00";
    const primo = primoDi(1, "2026-10-26T10:00:00.000Z"); // ieri 11:00 Roma: sono passate 25 ore
    const d = decidi([modulo("m1", 1, "attesa_whatsapp")], [primo], adesso);
    c(
      "dopo il primo contatto, un lead in «attesa_whatsapp» riceve il richiamo n24|tel9",
      [1, "invia", `n24|${t9(1)}`, "richiamo_24h"],
      [d.length, d[0]?.tipo, d[0]?.chiave, d[0]?.extra?.quale],
    );
    const dc = decidi([modulo("m1", 1, "da_contattare")], [primo], adesso);
    c(
      "…identico a un lead rimasto «da contattare» (prima della modifica)",
      [dc[0]?.tipo, dc[0]?.chiave],
      [d[0]?.tipo, d[0]?.chiave],
    );
    c(
      "…e la sequenza finita (n24 già preso) tace anche per «attesa_whatsapp»",
      [],
      decidi(
        [modulo("m1", 1, "attesa_whatsapp")],
        [
          primo,
          {
            ...primo,
            tipo: "richiamo_24h",
            chiave: `n24|${t9(1)}`,
            prenotatoIl: "2026-10-27T10:30:00.000Z",
          },
        ],
        "2026-10-27T13:00:00+01:00",
      ).filter((x) => x.tipo === "invia"),
    );

    //  il primo contatto resta solo per «da contattare»
    c(
      "un lead del modulo in «attesa_whatsapp» SENZA primo contatto nel registro non lo riceve",
      [],
      decidi([modulo("m1", 2, "attesa_whatsapp")], [], MAR10).filter((x) => x.tipo === "invia"),
    );
    c(
      "…un importato in «attesa_whatsapp» (senza modulo) non lo riceve",
      [],
      decidi(
        [
          {
            id: "i1",
            data: { nome: "Carla", telefono: tel(3), stato: "attesa_whatsapp", importato: true },
          },
        ],
        [],
        MAR10,
      ),
    );
    c(
      "…mentre «da contattare» lo riceve",
      ["invia", "primo_contatto"],
      (() => {
        const x = decidi([modulo("m1", 2, "da_contattare")], [], MAR10)[0];
        return [x?.tipo, x?.extra?.quale];
      })(),
    );

    //  il ritorno vale ancora
    const ritorno = decidi(
      [
        {
          id: "r1",
          data: {
            nome: "Carla",
            telefono: tel(4),
            stato: "attesa_whatsapp",
            ricarico: { volte: 2, ultimo: "2026-10-27T08:00:00.000Z", daDecidere: true },
          },
        },
      ],
      [],
      MAR10,
    );
    c(
      "il messaggio di ritorno vale anche per «attesa_whatsapp»",
      ["invia", "ritorno", `r|${t9(4)}|2026-10-27T08:00:00.000Z`],
      [ritorno[0]?.tipo, ritorno[0]?.extra?.quale, ritorno[0]?.chiave],
    );

    //  nessun messaggio «per stato»
    c(
      "nessun messaggio «per stato» per «attesa_whatsapp» (non è nella tabella)",
      false,
      "attesa_whatsapp" in T.TABELLA_STATI,
    );
  }

  gruppo("MANYCHAT · ATTESA WHATSAPP · LA MIGRAZIONE (TESTO)");
  {
    const percorso = join(
      radice,
      "supabase/migrations/20261028170000_manychat_attesa_whatsapp.sql",
    );
    c("la migrazione esiste", true, existsSync(percorso));
    if (existsSync(percorso)) {
      const sql = senzaCommenti(readFileSync(percorso, "utf8"));
      const alto = sql.toUpperCase();
      c(
        "una sola funzione nuova: lead_attesa_whatsapp(uuid, uuid, timestamptz) → boolean",
        [1, true],
        [
          (sql.match(/CREATE OR REPLACE FUNCTION/gi) ?? []).length,
          /FUNCTION public\.lead_attesa_whatsapp\(\s*p_user_id uuid,\s*p_id uuid,\s*p_il timestamptz\s*\)\s*RETURNS boolean/i.test(
            sql,
          ),
        ],
      );
      c(
        "SECURITY DEFINER con search_path fissato",
        true,
        /SECURITY DEFINER SET search_path = public/i.test(sql),
      );
      c(
        "solo service_role: REVOKE a PUBLIC, anon, authenticated e GRANT a service_role",
        [true, true],
        [
          /REVOKE ALL ON FUNCTION public\.lead_attesa_whatsapp\(uuid, uuid, timestamptz\) FROM PUBLIC, anon, authenticated/i.test(
            sql,
          ),
          /GRANT EXECUTE ON FUNCTION public\.lead_attesa_whatsapp\(uuid, uuid, timestamptz\) TO service_role/i.test(
            sql,
          ),
        ],
      );
      c(
        "l'UPDATE ha user_id e la guardia «ancora da_contattare» nel WHERE",
        [true, true, true],
        [
          /UPDATE public\.crm_leads/i.test(sql),
          /WHERE[^;]*user_id = p_user_id/i.test(sql),
          /WHERE[^;]*data->>'stato' = 'da_contattare'/i.test(sql),
        ],
      );
      c(
        "tocca solo stato, statoDal e i due campi di «da dove veniva» con jsonb_set (mai data intera)",
        [["stato", "statoDal", "statoPrecedente", "statoPrecedenteIl"], false],
        [[...sql.matchAll(/'\{(\w+)\}'/g)].map((x) => x[1]), /SET data = (?!jsonb_set)/i.test(sql)],
      );
      c(
        "scrive «attesa_whatsapp» e ritorna se ha scritto (FOUND)",
        [true, true],
        [/'attesa_whatsapp'/.test(sql), /RETURN FOUND|GET DIAGNOSTICS/i.test(sql)],
      );
      c(
        "nessun DROP, DELETE, TRUNCATE né ALTER TABLE: solo una funzione nuova",
        [false, false, false, false],
        [
          /\bDROP\b/.test(alto),
          /\bDELETE\b/.test(alto),
          /\bTRUNCATE\b/.test(alto),
          /\bALTER TABLE\b/.test(alto),
        ],
      );
      c(
        "parentesi e $$ bilanciati",
        [0, 0],
        [
          [...sql].reduce((n, ch) => n + (ch === "(" ? 1 : ch === ")" ? -1 : 0), 0),
          (sql.match(/\$\$/g) ?? []).length % 2,
        ],
      );
    }
  }

  gruppo("MANYCHAT · ATTESA WHATSAPP · LO SCRIPT PER I GIÀ CONTATTATI (TESTO)");
  {
    //  Sta accanto alla commessa e in `supabase/recuperi/`: mai in `migrations/`.
    const percorso = join(radice, "supabase/recuperi/20261028_attesa_whatsapp_gia_contattati.sql");
    c("lo script esiste in supabase/recuperi/", true, existsSync(percorso));
    c(
      "…e non è tra le migrazioni (non parte da solo)",
      false,
      existsSync(
        join(radice, "supabase/migrations/20261028170000_manychat_attesa_whatsapp_recupero.sql"),
      ),
    );
    if (existsSync(percorso)) {
      const grezzo = readFileSync(percorso, "utf8");
      const sql = senzaCommenti(grezzo);
      const alto = sql.toUpperCase();
      c(
        "prima la prova a secco (SELECT di conteggio), poi l'UPDATE",
        true,
        alto.indexOf("SELECT") >= 0 &&
          alto.indexOf("SELECT") < alto.indexOf("UPDATE PUBLIC.CRM_LEADS"),
      );
      c(
        "un solo UPDATE, su crm_leads, e nessun DELETE, DROP, TRUNCATE o INSERT",
        [1, false, false, false, false],
        [
          (alto.match(/\bUPDATE\b/g) ?? []).length,
          /\bDELETE\b/.test(alto),
          /\bDROP\b/.test(alto),
          /\bTRUNCATE\b/.test(alto),
          /\bINSERT\b/.test(alto),
        ],
      );
      c(
        "porta a «attesa_whatsapp» solo chi è «da_contattare»",
        [true, true],
        [/'attesa_whatsapp'/.test(sql), /data->>'stato' = 'da_contattare'/.test(sql)],
      );
      c(
        "cerca in manychat_invii: primo_contatto o ritorno, stato inviato, stesso user_id",
        [true, true, true],
        [
          /manychat_invii/.test(sql),
          /tipo IN \('primo_contatto', 'ritorno'\)/.test(sql),
          /i\.user_id = l\.user_id/.test(sql),
        ],
      );
      c(
        "abbina per lead_id o per le ultime 9 cifre del telefono",
        [true, true],
        [/i\.lead_id = l\.id/.test(sql), /right\(regexp_replace\(/i.test(sql)],
      );
      c(
        "tocca solo stato, statoDal, statoPrecedente e statoPrecedenteIl (jsonb_set, mai data intera)",
        [4, false],
        [(sql.match(/jsonb_set\(/gi) ?? []).length - 0, /SET data = (?!jsonb_set)/i.test(sql)],
      );
      c("rilanciabile: il WHERE esclude chi è già passato", true, /da_contattare/.test(sql));
    }
  }
}
