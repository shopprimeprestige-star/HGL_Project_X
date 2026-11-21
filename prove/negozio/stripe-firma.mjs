/** ── NEGOZIO · RILASCIO 2 · T44 · LA FIRMA DEL WEBHOOK DI STRIPE ─────────────────────────────────────
 *  `src/shop/stripe/firma.ts` (D45). `verificaFirma(corpo: Uint8Array, intestazione, segreto, adesso, tolleranzaS = 300)`:
 *   · si firmano i BYTE del corpo (un BOM davanti cambia la firma: `text()` lo toglierebbe, `arrayBuffer()` no);
 *   · `t` solo cifre, tolleranza 300 s nel passato E nel futuro; uno o più `v1`, basta uno giusto;
 *   · confronto con `crypto.subtle.verify("HMAC", …)` (tempo costante, nessun ciclo a mano);
 *   · esito tipato: ok | assente | malformata | vecchia | futura | sbagliata, e mai un'eccezione.
 *  `adesso` è in MILLISECONDI (come `Date.now()` e come il resto del codice del negozio).
 *  I vettori li calcola la prova con `crypto.subtle` (`_stripe-finto.mjs`), controllati contro `node:crypto`: MAI copiati da un esempio del web. */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { firmaStripe, eventoFirmato, SEGRETO_PROVA, T0 } from "./_stripe-finto.mjs";

const enc = new TextEncoder();
const ADESSO = T0 * 1000;
/** Il valore `v1` dentro un'intestazione `t=…,v1=…`. */
const v1Di = (intestazione) => /v1=([0-9a-f]+)/.exec(intestazione)[1];
/** Un'intestazione per `t` (secondi) e un corpo, col segreto dato. */
const firma = (corpo, t, segreto = SEGRETO_PROVA) => firmaStripe(corpo, segreto, t);

export async function prove(mod, { c, gruppo, radice }) {
  const F = mod["shop/stripe/firma"];
  gruppo("SHOP R2 · T44 · FIRMA DEL WEBHOOK STRIPE (21/11/2026)");
  c("il modulo c'è", true, !!F);
  if (!F) return;
  const { verificaFirma: verifica } = F;
  const corpo = enc.encode(JSON.stringify({ id: "evt_prova0000000001", type: "checkout.session.completed", data: { object: { id: "cs_test_x" } } }));

  /* il vettore: il finto (crypto.subtle) e node:crypto devono dare la stessa firma, altrimenti la prova non vale niente */
  const intestazione = await firma(corpo, T0);
  const attesa = createHmac("sha256", SEGRETO_PROVA).update(Buffer.concat([Buffer.from(`${T0}.`), Buffer.from(corpo)])).digest("hex");
  c("il vettore è giusto (subtle = node:crypto)", attesa, v1Di(intestazione));

  /* ── il caso buono e le alterazioni ── */
  c("firma valida → ok", "ok", await verifica(corpo, intestazione, SEGRETO_PROVA, ADESSO));
  const v1 = v1Di(intestazione);
  const cambiaUnSegno = (s) => (s[0] === "0" ? "1" : "0") + s.slice(1);
  c("firma alterata di un carattere → sbagliata", "sbagliata", await verifica(corpo, `t=${T0},v1=${cambiaUnSegno(v1)}`, SEGRETO_PROVA, ADESSO));
  const corpoAltro = corpo.slice();
  corpoAltro[corpoAltro.length - 3] ^= 1;
  c("corpo alterato di un byte → sbagliata", "sbagliata", await verifica(corpoAltro, intestazione, SEGRETO_PROVA, ADESSO));
  c("segreto diverso → sbagliata", "sbagliata", await verifica(corpo, intestazione, `${SEGRETO_PROVA}x`, ADESSO));
  c("segreto vuoto → mai ok", "sbagliata", await verifica(corpo, intestazione, "", ADESSO));
  c("t cambiato a mano (stessa firma) → sbagliata", "sbagliata", await verifica(corpo, `t=${T0 + 1},v1=${v1}`, SEGRETO_PROVA, ADESSO + 1000));

  /* ── l'età: 300 s nel passato e nel futuro ── */
  c("t di 301 s fa → vecchia", "vecchia", await verifica(corpo, await firma(corpo, T0 - 301), SEGRETO_PROVA, ADESSO));
  c("t di 299 s fa → ok", "ok", await verifica(corpo, await firma(corpo, T0 - 299), SEGRETO_PROVA, ADESSO));
  c("t di 300 s fa (il limite) → ok", "ok", await verifica(corpo, await firma(corpo, T0 - 300), SEGRETO_PROVA, ADESSO));
  c("t di 301 s nel futuro → futura", "futura", await verifica(corpo, await firma(corpo, T0 + 301), SEGRETO_PROVA, ADESSO));
  c("t di 299 s nel futuro → ok", "ok", await verifica(corpo, await firma(corpo, T0 + 299), SEGRETO_PROVA, ADESSO));
  c("tolleranza scelta dal chiamante (60 s): 61 s fa → vecchia", "vecchia", await verifica(corpo, await firma(corpo, T0 - 61), SEGRETO_PROVA, ADESSO, 60));
  c("vecchia ma con firma sbagliata → sbagliata (la firma conta prima)", "sbagliata", await verifica(corpo, `t=${T0 - 1000},v1=${cambiaUnSegno(v1)}`, SEGRETO_PROVA, ADESSO));
  c("adesso non è un numero → mai ok", false, (await verifica(corpo, intestazione, SEGRETO_PROVA, Number.NaN)) === "ok");
  c("adesso non è un numero (undefined) → mai ok", false, (await verifica(corpo, intestazione, SEGRETO_PROVA, undefined)) === "ok");

  /* ── la forma dell'intestazione ── */
  c("t con lettere → malformata", "malformata", await verifica(corpo, `t=12ab,v1=${v1}`, SEGRETO_PROVA, ADESSO));
  c("t negativo → malformata", "malformata", await verifica(corpo, `t=-5,v1=${v1}`, SEGRETO_PROVA, ADESSO));
  c("t con decimali → malformata", "malformata", await verifica(corpo, `t=${T0}.5,v1=${v1}`, SEGRETO_PROVA, ADESSO));
  c("t enorme → malformata", "malformata", await verifica(corpo, `t=${"9".repeat(30)},v1=${v1}`, SEGRETO_PROVA, ADESSO));
  c("due t → malformata (mai scegliere quale)", "malformata", await verifica(corpo, `t=${T0},t=${T0},v1=${v1}`, SEGRETO_PROVA, ADESSO));
  c("senza t → malformata", "malformata", await verifica(corpo, `v1=${v1}`, SEGRETO_PROVA, ADESSO));
  c("senza v1 → malformata", "malformata", await verifica(corpo, `t=${T0}`, SEGRETO_PROVA, ADESSO));
  c("v1 non esadecimale → malformata", "malformata", await verifica(corpo, `t=${T0},v1=zzzz`, SEGRETO_PROVA, ADESSO));
  c("testo qualunque → malformata", "malformata", await verifica(corpo, "pippo", SEGRETO_PROVA, ADESSO));
  c("intestazione assente (null) → assente", "assente", await verifica(corpo, null, SEGRETO_PROVA, ADESSO));
  c("intestazione assente (undefined) → assente", "assente", await verifica(corpo, undefined, SEGRETO_PROVA, ADESSO));
  c("intestazione vuota → assente", "assente", await verifica(corpo, "", SEGRETO_PROVA, ADESSO));
  c("intestazione che non è testo → assente", "assente", await verifica(corpo, 123, SEGRETO_PROVA, ADESSO));
  c("spazi attorno alle voci → ok", "ok", await verifica(corpo, ` t=${T0} , v1=${v1} `, SEGRETO_PROVA, ADESSO));
  c("v1 in maiuscolo → ok", "ok", await verifica(corpo, `t=${T0},v1=${v1.toUpperCase()}`, SEGRETO_PROVA, ADESSO));

  /* ── più v1 (Stripe ne manda due quando il segreto è in rotazione): basta uno giusto ── */
  const sbagliata = "0".repeat(64);
  c("due v1, il primo giusto → ok", "ok", await verifica(corpo, `t=${T0},v1=${v1},v1=${sbagliata}`, SEGRETO_PROVA, ADESSO));
  c("due v1, il secondo giusto → ok", "ok", await verifica(corpo, `t=${T0},v1=${sbagliata},v1=${v1}`, SEGRETO_PROVA, ADESSO));
  c("due v1 entrambi sbagliati → sbagliata", "sbagliata", await verifica(corpo, `t=${T0},v1=${sbagliata},v1=${"1".repeat(64)}`, SEGRETO_PROVA, ADESSO));
  c("v0 (vecchio schema) accanto a v1 → ok", "ok", await verifica(corpo, `t=${T0},v0=${sbagliata},v1=${v1}`, SEGRETO_PROVA, ADESSO));
  c("solo v0 → malformata", "malformata", await verifica(corpo, `t=${T0},v0=${v1}`, SEGRETO_PROVA, ADESSO));
  const enorme = `t=${T0},${Array.from({ length: 10_000 }, () => `v1=${sbagliata}`).join(",")},v1=${v1}`;
  c("10 000 v1 sbagliati → non ok (il lavoro ha un tetto) e non lancia", false, (await verifica(corpo, enorme, SEGRETO_PROVA, ADESSO)) === "ok");

  /* ── i byte, non il testo ── */
  const conBom = await eventoFirmato({ id: "evt_prova0000000001", type: "x" }, { bom: true });
  const senzaBom = await eventoFirmato({ id: "evt_prova0000000001", type: "x" }, { bom: false });
  c("il corpo con BOM firmato con BOM → ok", "ok", await verifica(conBom.corpo, conBom.intestazione, SEGRETO_PROVA, ADESSO));
  c("il BOM CAMBIA la firma (la firma di prima non vale)", false, v1Di(conBom.intestazione) === v1Di(senzaBom.intestazione));
  c("corpo con BOM e firma del corpo senza BOM → sbagliata", "sbagliata", await verifica(conBom.corpo, senzaBom.intestazione, SEGRETO_PROVA, ADESSO));
  c("corpo senza BOM e firma del corpo con BOM → sbagliata", "sbagliata", await verifica(senzaBom.corpo, conBom.intestazione, SEGRETO_PROVA, ADESSO));
  c("corpo vuoto firmato → ok", "ok", await verifica(new Uint8Array(), await firma(new Uint8Array(), T0), SEGRETO_PROVA, ADESSO));
  const binario = new Uint8Array([0, 255, 128, 10, 13]);
  c("corpo binario firmato → ok", "ok", await verifica(binario, await firma(binario, T0), SEGRETO_PROVA, ADESSO));

  /* ── mai un'eccezione ── */
  let lanciato = null;
  try {
    for (const strano of [undefined, null, 0, "x", {}, []]) await verifica(corpo, strano, strano, strano);
    await verifica(new Uint8Array(), `t=${T0},v1=${v1}`, undefined, ADESSO);
  } catch (e) { lanciato = String(e); }
  c("con ingressi strani non lancia mai", null, lanciato);

  /* ── il confronto è di subtle.verify (prova di sorgente) ── */
  const sorgente = readFileSync(join(radice, "src/shop/stripe/firma.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("sorgente: c'è crypto.subtle.verify", true, /subtle\s*\.\s*verify\s*\(/.test(sorgente));
  c("sorgente: non si calcola la firma attesa per confrontarla (niente subtle.sign)", false, /subtle\s*\.\s*sign\s*\(/.test(sorgente));
  c("sorgente: nessun ciclo a mano con XOR sui segni", false, /\^=|charCodeAt/.test(sorgente));
  c("sorgente: nessun === / !== fra firme", false, /(firma|v1|atteso|attesa|calcolat\w*|signature)\w*\s*[!=]==\s*\w/i.test(sorgente));
  c("sorgente: il segreto non è letto qui (niente process.env)", false, /process\.env|import\.meta\.env/.test(sorgente));
}
