/** ── PROVE: L'ECO SENZA CONTENUTO NON È UN MESSAGGIO DEL CLIENTE (31/10/2026) ────────────────────
 *  Guasto del titolare («non è la prima volta»): dopo ogni messaggio scritto dal telefono compariva,
 *  1-3 secondi dopo, una bolla in entrata «Reazione, sticker o posizione: aprila in ManyChat». Il
 *  Default Reply in coesistenza rimanda l'uscita come entrata, ma senza testo; `ecoDi` controllava
 *  solo i testi e `tratta` saltava il controllo per un testo vuoto: la riga veniva scritta come
 *  «[messaggio senza testo]», con non letti +1 e `ultimo_in_entrata_il` aggiornato.
 *  Dati inventati (numero e orari); nessun dato di cliente. */
export function proveEcoFantasma(mod, { c, gruppo }) {
  const RS = mod["manychat/risposta"];
  const E = mod["chatwa/eco"];
  return (async () => {
    const TEL = "393330001122";
    const SUB = "1000077";
    const U = "u-1";
    const alle = (hhmmss) => new Date(`2026-10-31T${hhmmss}Z`);
    const iso = (hhmmss) => alle(hhmmss).toISOString();

    /** Il mondo finto: solo quello che serve a questa rotta. */
    function mondo({ uscite = [], guastoUscite = false, nota = true } = {}) {
      const m = { scritti: [], rubrica: [], avvisi: [], uscite, push: 0, rpc: 0 };
      m.porte = {
        avviso: (x) => m.avvisi.push(x),
        utente: async () => ({ userId: U }),
        invii: async () => [],
        contattoNoto: async () => (nota ? { leadId: null } : null),
        ultimeEntrate: async () =>
          m.scritti.map((x) => ({ testo: x.testo, il: x.adesso, media: null })).reverse(),
        ultimeUscite: async (_u, _t, adesso) => {
          if (guastoUscite) throw { code: "XX005", message: `dato ${TEL}` };
          return m.uscite.filter((d) => d.getTime() <= adesso.getTime() + 5_000);
        },
        registraMessaggio: async (_u, msg) => {
          if (m.scritti.some((x) => x.waId === msg.waId)) return "doppione";
          m.scritti.push(msg);
          return "nuovo";
        },
        aggiornaContatto: async (_u, x) => m.rubrica.push(x),
        avvisaNuovo: async () => {
          m.push++;
        },
        conferma: () => ({
          schedeConMessaggio: async () => [],
          aggiorna: async () => ({ error: null }),
          segnaStop: async () => ({ error: null }),
          avviso: () => undefined,
        }),
        rispostaArrivata: async () => undefined,
        contattoDi: async () => null,
        scriviContatto: async () => false,
      };
      return m;
    }
    const manda = (m, testo, quando) =>
      RS.gestisciRisposta(m.porte, {
        chiaveOk: true,
        segretoPresente: true,
        corpo: { crmInvioId: "", crmLeadId: "", subscriberId: SUB, telefono: TEL, testo },
        adesso: alle(quando),
      });

    gruppo("ECO SENZA CONTENUTO: IL SERVER LA SCARTA");
    //  Il caso del titolare: nostro messaggio alle 11:18:10 dal telefono, eco senza testo 2 s dopo.
    for (const [nome, testo] of [
      ["segnaposto {{...}} (ManyChat non sa leggere l'input)", "{{last_input_text}}"],
      ["testo vuoto", ""],
      ["«[messaggio senza testo]» già scritto", "[messaggio senza testo]"],
    ]) {
      const m = mondo({ uscite: [alle("11:18:10")] });
      const r = await manda(m, testo, "11:18:12");
      c(
        `${nome} 2 secondi dopo un nostro messaggio → «eco», niente riga, niente rubrica, niente push`,
        ["eco", 0, 0, 0],
        [r.esito, m.scritti.length, m.rubrica.length, m.push],
      );
    }
    {
      const m = mondo({ uscite: [alle("11:18:10")] });
      const r = await manda(m, "{{x}}", "11:18:39");
      c("29 secondi dopo il nostro messaggio: ancora eco", ["eco", 0], [r.esito, m.scritti.length]);
    }
    {
      //  Due messaggi di fila dal telefono (11:18 e 11:18:40): due eco, nessuna riga.
      const m = mondo({ uscite: [alle("11:18:10"), alle("11:18:40")] });
      const a = await manda(m, "{{x}}", "11:18:12");
      const b = await manda(m, "{{x}}", "11:18:42");
      c(
        "due messaggi nostri di fila, due eco: zero righe",
        ["eco", "eco", 0],
        [a.esito, b.esito, m.scritti.length],
      );
    }
    {
      //  L'ora del telefono avanti di 3 secondi: il nostro messaggio sembra dopo l'eco.
      const m = mondo({ uscite: [alle("11:18:13")] });
      const r = await manda(m, "{{x}}", "11:18:11");
      c("orologio del telefono avanti di 2 secondi: eco lo stesso", "eco", r.esito);
    }

    gruppo("ECO SENZA CONTENUTO: LE REAZIONI E GLI STICKER VERI PASSANO");
    {
      const m = mondo({ uscite: [] });
      const r = await manda(m, "{{last_input_text}}", "11:18:12");
      c(
        "senza nostri messaggi prima: registrata come «messaggio senza testo», rubrica e push come prima",
        ["registrata", 1, "[messaggio senza testo]", 1, 1],
        [r.esito, m.scritti.length, m.scritti[0]?.testo, m.rubrica.length, m.push],
      );
    }
    {
      const m = mondo({ uscite: [alle("11:10:00")] });
      const r = await manda(m, "{{x}}", "11:18:12");
      c(
        "l'ultimo nostro messaggio è di 8 minuti prima: è il cliente, si registra",
        ["registrata", 1],
        [r.esito, m.scritti.length],
      );
    }
    {
      const m = mondo({ uscite: [alle("11:18:10")] });
      const r = await manda(m, "{{x}}", "11:18:41");
      c(
        "31 secondi dopo il nostro messaggio: oltre la finestra, si registra",
        ["registrata", 1],
        [r.esito, m.scritti.length],
      );
    }
    {
      const m = mondo({ uscite: [alle("11:18:30")] });
      const r = await manda(m, "{{x}}", "11:18:20");
      c(
        "il nostro messaggio è 10 secondi DOPO l'entrata: non è la sua causa, si registra",
        ["registrata", 1],
        [r.esito, m.scritti.length],
      );
    }
    {
      const m = mondo({ uscite: [alle("11:18:10")] });
      const r = await manda(m, "Va bene, grazie", "11:18:12");
      c(
        "un testo vero 2 secondi dopo il nostro messaggio passa (il controllo è solo per l'eco vuota)",
        ["registrata", 1],
        [r.esito, m.scritti.length],
      );
    }
    {
      const m = mondo({ uscite: [alle("11:18:10")], nota: false });
      const r = await manda(m, "{{x}}", "11:18:12");
      c(
        "sconosciuto con solo segnaposto: scartato come prima («segnaposto»), senza leggere le uscite",
        ["segnaposto", 0],
        [r.esito, m.scritti.length],
      );
    }

    gruppo("ECO SENZA CONTENUTO: LETTURA GUASTA");
    {
      const m = mondo({ uscite: [alle("11:18:10")], guastoUscite: true });
      const r = await manda(m, "{{x}}", "11:18:12");
      c(
        "lettura delle uscite guasta: si registra come prima (meglio un'eco che un cliente perso)",
        ["registrata", 1],
        [r.esito, m.scritti.length],
      );
      c(
        "…e nell'avviso c'è solo il codice, mai numero né dati",
        true,
        m.avvisi.length === 1 && m.avvisi[0].includes("XX005") && !m.avvisi[0].includes(TEL),
      );
    }

    gruppo("ECO SENZA CONTENUTO: LA FUNZIONE PURA");
    c("ecoSenzaContenuto: nessuna uscita → no", false, RS.ecoSenzaContenuto([], alle("11:18:12")));
    c(
      "ecoSenzaContenuto: uscita 1 s prima → sì",
      true,
      RS.ecoSenzaContenuto([alle("11:18:11")], alle("11:18:12")),
    );
    c(
      "eSenzaContenuto: vuoto, segnaposto, «[messaggio senza testo]» sì; parole e link media no",
      [true, true, true, false, false],
      [
        E.eSenzaContenuto(""),
        E.eSenzaContenuto("{{a}} {{b}}"),
        E.eSenzaContenuto("[messaggio senza testo]"),
        E.eSenzaContenuto("ok"),
        E.eSenzaContenuto(
          "https://manybot-files.s3.eu-central-1.amazonaws.com/p/wa/2026/10/31/a.jpg",
        ),
      ],
    );

    gruppo("ECO SENZA CONTENUTO: LE RIGHE GIÀ SCRITTE SPARISCONO DALLA CHAT (SENZA CANCELLARE)");
    let n = 0;
    const riga = (direction, hhmmss, body, extra = {}) => ({
      id: `r${++n}`,
      user_id: U,
      lead_id: null,
      direction,
      from_number: direction === "inbound" ? `+${TEL}` : "+390000000000",
      to_number: direction === "inbound" ? "manychat" : `+${TEL}`,
      body,
      status: direction === "inbound" ? "delivered" : "sent",
      wa_message_id: direction === "inbound" ? `mc-in:${n}` : `wamid.${n}`,
      error_message: null,
      created_at: iso(hhmmss),
      delivered_at: null,
      read_at: null,
      canale: direction === "inbound" ? "manychat" : "baileys",
      ...extra,
    });
    {
      //  Il caso di oggi: «Yuri ci siamo?» 11:18:05, fantasma 11:18:07; «Oppure…» 11:18:50, fantasma 11:18:53.
      const righe = [
        riga("inbound", "10:00:00", "Buongiorno"),
        riga("outbound", "11:18:05", "ci siamo?"),
        riga("inbound", "11:18:07", "[messaggio senza testo]"),
        riga("outbound", "11:18:50", "Oppure vogliamo spostare?"),
        riga("inbound", "11:18:53", "{{last_input_text}}"),
      ];
      const fuori = E.idEco(righe);
      c(
        "i due fantasmi di oggi si nascondono, il resto no",
        ["r3", "r5"].sort(),
        [...fuori].sort(),
      );
      c(
        "senzaEco non tocca le righe del database: l'originale ha ancora 5 righe",
        [5, 3],
        [righe.length, E.senzaEco(righe).length],
      );
    }
    {
      const righe = [
        riga("outbound", "11:18:05", "ci siamo?"),
        riga("inbound", "11:30:00", "[messaggio senza testo]"),
      ];
      c(
        "una reazione 12 minuti dopo il nostro messaggio resta (è del cliente)",
        0,
        E.idEco(righe).size,
      );
    }
    {
      const righe = [riga("inbound", "11:18:07", "[messaggio senza testo]")];
      c("senza nessun nostro messaggio prima: resta", 0, E.idEco(righe).size);
    }
    {
      //  Il ponte scrive il nostro messaggio dopo l'eco (arriva tardi, ma con l'ora del telefono).
      const righe = [
        riga("inbound", "11:18:07", "[messaggio senza testo]"),
        riga("outbound", "11:18:05", "ci siamo?"),
      ].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      c(
        "il nostro messaggio scritto dopo l'eco (ora del telefono prima): si nasconde lo stesso",
        1,
        E.idEco(righe).size,
      );
    }
    {
      const righe = [
        riga("outbound", "11:18:05", "ci siamo?", { status: "failed" }),
        riga("inbound", "11:18:07", "[messaggio senza testo]"),
      ];
      c(
        "nostro messaggio NON partito (failed): non ha fatto ripartire niente, la riga resta",
        0,
        E.idEco(righe).size,
      );
    }
    {
      const righe = [
        riga("outbound", "11:18:05", "ci siamo?"),
        riga(
          "inbound",
          "11:18:07",
          "https://manybot-files.s3.eu-central-1.amazonaws.com/p/wa/2026/10/31/a.jpg",
          {
            media_type: "image",
          },
        ),
        riga("inbound", "11:18:08", "Sì, grazie"),
      ];
      c(
        "una foto (link) o un testo vero dopo il nostro messaggio non sono eco",
        0,
        E.idEco(righe).size,
      );
    }
    {
      const altro = riga("outbound", "11:18:05", "ciao", { to_number: "+393339999999" });
      const righe = [altro, riga("inbound", "11:18:07", "[messaggio senza testo]")];
      c("un nostro messaggio a un ALTRO numero non spiega l'eco", 0, E.idEco(righe).size);
    }
    {
      const righe = [
        riga("outbound", "11:18:05", "ci siamo?"),
        riga("inbound", "11:18:07", "[messaggio senza testo]", {
          canale: "baileys",
          wa_message_id: "baileys:1",
        }),
      ];
      c("una riga del ponte (non mc-in) non si tocca", 0, E.idEco(righe).size);
    }
    c(
      "ECO_VUOTA_DOPO_MS = 30 secondi, tolleranza 5",
      [30_000, 5_000],
      [E.ECO_VUOTA_DOPO_MS, E.ECO_VUOTA_PRIMA_MS],
    );
  })();
}
