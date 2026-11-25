/** ── NEGOZIO · T09 · IL CANCELLO DI USCITA ─────────────────────────────────
 *  `src/crm/negozio/cancello.ts` (D26, SPEC §11b): `condizioniUscita(stato)` → `{ righe, puoAprire }`.
 *  Nel R1 sono valutabili solo tre condizioni (prodotti con foto, nessuno senza foto, banner): le altre (pagamento,
 *  spedizione e resi, email di conferma, migrazione M2) sono «non ancora valutabili» e valgono «no»: in produzione il
 *  R1 non può aprire lo shop. Tutto inventato. */
export async function prove(mod, { c, gruppo }) {
  const { condizioniUscita, CHIAVI_CONDIZIONI } = mod["negozio/cancello"];
  gruppo("NEGOZIO · IL CANCELLO DI USCITA (20/11/2026)");
  const r1 = (pubblicati, conFoto, banner = true) => condizioniUscita({ pubblicati, conFotoPrincipale: conFoto, bannerPresente: banner });
  const tutteVere = { pubblicati: 3, conFotoPrincipale: 3, bannerPresente: true, pagamentoIncassa: true, spedizioneResi: true, emailConferma: true, migrazioneOrdini: true };
  const riga = (e, chiave) => e.righe.find((x) => x.chiave === chiave);

  c("le sette condizioni, nell'ordine della SPEC, con chiavi diverse", ["catalogo_reale", "foto_vere", "pagamento", "spedizione_resi", "email_conferma", "banner_consenso", "migrazione_ordini"], condizioniUscita({}).righe.map((x) => x.chiave));
  c("…le stesse chiavi sono esportate", condizioniUscita({}).righe.map((x) => x.chiave), [...CHIAVI_CONDIZIONI]);
  c("0 pubblicati → non si apre", false, r1(0, 0).puoAprire);
  c("1 pubblicato con foto → non si apre (ne servono almeno 2)", [false, false], ((e) => [e.puoAprire, riga(e, "catalogo_reale").ok])(r1(1, 1)));
  const e2 = r1(2, 1);
  c("2 pubblicati ma uno senza foto principale → non si apre, e la riga «foto vere» lo dice", [false, false, false], [e2.puoAprire, riga(e2, "foto_vere").ok, riga(e2, "catalogo_reale").ok]);
  const e3 = r1(3, 3);
  c("3 pubblicati con foto: le prime due condizioni sono vere", [true, true], [riga(e3, "catalogo_reale").ok, riga(e3, "foto_vere").ok]);
  c("…ma nel R1 non si apre lo stesso (pagamento, spedizione e resi, email, M2 non valutabili)", [false, false, false, false, false], ["pagamento", "spedizione_resi", "email_conferma", "migrazione_ordini"].map((k) => riga(e3, k).ok).concat(e3.puoAprire));
  c("…le quattro non valutabili sono marcate così e dicono «si attiva col rilascio della cassa»", [true, true, true, true], ["pagamento", "spedizione_resi", "email_conferma", "migrazione_ordini"].map((k) => !riga(e3, k).valutabile && /rilascio della cassa/.test(riga(e3, k).frase)));
  c("le tre del R1 sono valutabili", [true, true, true], ["catalogo_reale", "foto_vere", "banner_consenso"].map((k) => riga(e3, k).valutabile));
  c("banner non presente → la riga è falsa", [true, false], ((e) => [riga(e, "banner_consenso").valutabile, riga(e, "banner_consenso").ok])(r1(3, 3, false)));
  c("banner non valutabile (null) → né vera né valutabile", [false, false], ((e) => [riga(e, "banner_consenso").valutabile, riga(e, "banner_consenso").ok])(r1(3, 3, null)));
  c("con tutto vero (come sarà col rilascio della cassa) → si apre", [true, true], ((e) => [e.puoAprire, e.righe.every((x) => x.ok && x.valutabile)])(condizioniUscita(tutteVere)));
  for (const k of ["pagamentoIncassa", "spedizioneResi", "emailConferma", "migrazioneOrdini", "bannerPresente"])
    c(`con tutto vero tranne «${k}» (falso) → non si apre`, false, condizioniUscita({ ...tutteVere, [k]: false }).puoAprire);
  for (const k of ["pagamentoIncassa", "spedizioneResi", "emailConferma", "migrazioneOrdini", "bannerPresente"])
    c(`con tutto vero tranne «${k}» (non valutabile) → non si apre`, false, condizioniUscita({ ...tutteVere, [k]: null }).puoAprire);
  c("ogni riga ha una frase in italiano, vera o no", [], [r1(0, 0), e3, condizioniUscita(tutteVere)].flatMap((e) => e.righe).filter((x) => typeof x.frase !== "string" || x.frase.length < 12));
  c("la frase di «catalogo reale» dice quanti ce ne sono", [true], [/\b1\b/.test(riga(r1(1, 1), "catalogo_reale").frase)]);
  const strano = [undefined, null, 5, "x", [], { pubblicati: NaN, conFotoPrincipale: -3 }, { pubblicati: "9", conFotoPrincipale: "9" }, { pubblicati: 2, conFotoPrincipale: 9 }];
  c("stati strani (vuoto, numeri storti, più foto che prodotti) non lanciano e non aprono mai", Array(strano.length).fill(false), strano.map((s) => condizioniUscita(s).puoAprire));
}
