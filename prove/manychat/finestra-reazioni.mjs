/** ── PROVE: UNA REAZIONE NON RIAPRE LA FINESTRA DI 24 ORE (30/10/2026) ─────────
 *
 *  Una reazione, uno sticker o una posizione sono inbound con body «[messaggio
 *  senza testo]»: per ManyChat non riaprono la finestra, il testo libero non
 *  arriva. Qui le regole pure (`chatwa/entrata-vera`) e i punti della chat che le
 *  usano: la finestra della chat, la scelta WhatsApp, il controllo della notte.
 *  La porta degli invii è provata in `porta.mjs`. Numeri e testi inventati.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo }`. */
export async function proveFinestraReazioni(mod, { c, gruppo }) {
  const E = mod["chatwa/entrata-vera"];
  const S = mod["chatwa/stato"];
  const Sc = mod["chatwa/scelta-whatsapp"];
  const F = mod["manychat/finestra"];

  const ADESSO = Date.parse("2026-10-30T14:00:00.000Z");
  const ORA = 3_600_000;
  const fa = (ore) => new Date(ADESSO - ore * ORA).toISOString();
  const SENZA = "Reazione, sticker o posizione: aprila in ManyChat";
  const contatto = (ore, anteprima) => ({ ultimo_in_entrata_il: fa(ore), ultimo_in_entrata_anteprima: anteprima });
  const inbound = (ore, body, extra = {}) => ({ direction: "inbound", body, created_at: fa(ore), from_number: "+393331234567", ...extra });

  gruppo("FINESTRA · UN MESSAGGIO VERO, NON UNA REAZIONE");
  c("body vuoto, assente o spazi: non è un messaggio", [false, false, false], [E.eEntrataVera(""), E.eEntrataVera(null), E.eEntrataVera("  \n")]);
  c("«[messaggio senza testo]»: non è un messaggio", false, E.eEntrataVera(" [messaggio senza testo] "));
  c("testo, link di un vocale: sono messaggi veri", [true, true], [E.eEntrataVera("Buongiorno"), E.eEntrataVera("https://esempio.test/wa/2026/10/30/a.ogg")]);
  c("anteprima di una reazione (etichetta della bolla, vecchia scritta, vuota): senza testo",
    [true, true, true], [E.anteprimaSenzaTesto(SENZA), E.anteprimaSenzaTesto("[messaggio senza testo]"), E.anteprimaSenzaTesto("")]);
  c("anteprima di testo, di un media, assente (righe vecchie): non è senza testo",
    [false, false, false], [E.anteprimaSenzaTesto("Ciao"), E.anteprimaSenzaTesto("Vocale"), E.anteprimaSenzaTesto(null)]);

  c("testo vero 2 ore fa: la colonna vale", fa(2), E.entrataPerFinestra(contatto(2, "Ciao"), []));
  c("reazione 2 ore fa, nessun altro messaggio: nessuna entrata", null, E.entrataPerFinestra(contatto(2, SENZA), []));
  c("reazione 1 ora fa, testo vero 5 ore fa: vale il testo", fa(5),
    E.entrataPerFinestra(contatto(1, SENZA), [inbound(5, "Ciao"), inbound(1, "[messaggio senza testo]")]));
  c("…le uscite, il ponte e i vuoti non contano", null,
    E.entrataPerFinestra(contatto(1, SENZA), [inbound(3, "ciao", { direction: "outbound" }), inbound(3, "ciao", { canale: "baileys" }), inbound(2, "")]));
  c("contatto senza entrate: null", null, E.entrataPerFinestra({ ultimo_in_entrata_il: null }, [inbound(2, "Ciao")]));
  c("la finestra per il testo: reazione sola chiusa, testo aperto, vocale aperto", [false, true, true],
    [SENZA, "Buongiorno", "Vocale"].map((a) => F.finestraPerTesto(E.entrataPerFinestra(contatto(2, a), []), new Date(ADESSO))));

  gruppo("FINESTRA · LE LETTURE SI FANNO SOLO PER CHI HA UNA REAZIONE");
  let letture = 0;
  const leggi = async (telefoni) => {
    letture++;
    return telefoni.length ? [inbound(4, "Ciao")] : [];
  };
  const righe = [
    { phone_e164: "+393331234567", ...contatto(1, SENZA) },
    { phone_e164: "+393339999999", ...contatto(1, "Ciao") },
  ];
  const fuori = await E.entrateVere(righe, leggi);
  c("chi ha scritto testo resta com'è, la reazione torna al testo vero", [fa(4), fa(1)], [fuori[0].ultimo_in_entrata_il, fuori[1].ultimo_in_entrata_il]);
  c("una sola lettura per tutte le righe", 1, letture);
  await E.entrateVere([righe[1]], leggi);
  c("nessuna reazione: nessuna lettura", 1, letture);
  const guasto = await E.entrateVere(righe, async () => Promise.reject(new Error("giù")));
  c("lettura guasta: la reazione resta senza finestra, il testo no", [null, fa(1)], [guasto[0].ultimo_in_entrata_il, guasto[1].ultimo_in_entrata_il]);

  gruppo("FINESTRA · LA CHAT: «PUOI SCRIVERE LIBERO»");
  const f24 = (cont, messaggi = []) => S.finestra24({ contatto: cont, messaggi, adesso: ADESSO });
  c("solo una reazione 2 ore fa: finestra chiusa, niente «Puoi scrivere libero»", [false, null],
    ((f) => [f.aperta, f.scadeIl])(f24(contatto(2, SENZA), [inbound(2, "[messaggio senza testo]")])));
  c("…e la frase è quella del modello", "Finestra di 24 ore chiusa: puoi mandare solo un modello approvato", f24(contatto(2, SENZA)).frase);
  c("testo vero 2 ore fa: aperta", [true, "Puoi scrivere libero ancora per 22 ore"], ((f) => [f.aperta, f.frase])(f24(contatto(2, "Ciao"))));
  c("vocale 2 ore fa: aperta", true, f24(contatto(2, "Vocale")).aperta);
  c("reazione 1 ora fa dopo un testo di 5 ore fa: aperta dal testo (ancora 19 ore)", [true, "Puoi scrivere libero ancora per 19 ore"],
    ((f) => [f.aperta, f.frase])(f24(contatto(1, SENZA), [inbound(5, "Ciao"), inbound(1, "[messaggio senza testo]")])));
  c("senza colonna, solo un «[messaggio senza testo]» caricato: chiusa", false,
    f24({ ultimo_in_entrata_il: null }, [inbound(2, "[messaggio senza testo]")]).aperta);
  c("senza colonna, un testo vero caricato: aperta", true, f24({ ultimo_in_entrata_il: null }, [inbound(2, "Ciao")]).aperta);

  gruppo("FINESTRA · LA SCELTA «WHATSAPP» / «WHATSAPP DEL CRM»");
  const id = "11111111-1111-4111-8111-111111111111";
  const sc = (cont, messaggi) => Sc.sceltaCrm({ id, ...cont }, new Date(ADESSO), messaggi).stato;
  c("solo una reazione 2 ore fa: CRM spento", "chiusa", sc(contatto(2, SENZA)));
  c("testo vero 2 ore fa: CRM acceso", "aperta", sc(contatto(2, "Ciao")));
  c("vocale 2 ore fa: CRM acceso", "aperta", sc(contatto(2, "Vocale")));
  c("reazione 1 ora fa, testo vero 5 ore fa: CRM acceso", "aperta", sc(contatto(1, SENZA), [inbound(5, "Ciao")]));
  c("contatto senza anteprima (righe vecchie): come prima, acceso", "aperta", sc({ ultimo_in_entrata_il: fa(2) }));
}
