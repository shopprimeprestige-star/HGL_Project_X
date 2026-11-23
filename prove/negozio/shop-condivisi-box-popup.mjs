/** ── VETRINA V1 · T84b2 · POP-UP D'USCITA, BOX E VOCI: I TRE COMPONENTI CONDIVISI CON LA LANDING ───────────────────────
 *  PIANO-V1 §5 T84b2, D85, criteri V1-T8 e V1-T3. `PopupUscita`, `BoxProdottoGiusto` e `VociProblema` girano oggi sulla scheda di
 *  `/shop/prodotto/$slug`: con i valori di partenza (`aspetto="oggi"`, `variante="scura"`) devono essere IDENTICI a prima.
 *  Prova doppia, tutto senza browser:
 *   1. il SORGENTE: `git diff` dal base (`99d94d3`) di ciascun file. Si ammettono righe aggiunte e le sole righe TOLTE che ricompaiono
 *      spostate (stessa riga, solo l'indentazione cambia) o, se sono righe di classi, con ogni stringa di classe uguale byte per byte in
 *      una riga aggiunta (nel pop-up: dentro `classiPopup`). Qualunque altra riga tolta è rossa.
 *   2. il DISEGNO VERO (`rendiComponente`): `BoxProdottoGiusto` e `VociProblema` col codice del base e col codice di adesso, con e senza
 *      la proprietà nuova: con i valori di partenza l'HTML è identico al byte. `classiPopup` (pura) e il valore di `azione` si leggono con
 *      una piccola sonda. `PopupUscita` col dialogo chiuso non disegna nulla (gli effetti non girano: l'apertura la prova la sorgente).
 *  L'evento (nota 9): il click su «Consulenza gratuita» del pop-up nuovo emette `consulenza_popup_click` con `azione` NUOVA, distinta da
 *  quelle di oggi («x», «no_grazie», «problema» + voce): serve perché il conteggio di Vendite non si confonda.
 *  Dati inventati, nessuna rete. Il base è il commit scritto qui sotto. */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rendiComponente } from "./_rende.mjs";

const BASE = "99d94d3"; // R2 unito: il codice che gira oggi
const CARTELLA = "src/components/landing/consulenza";
const FILE = { popup: `${CARTELLA}/PopupUscita.tsx`, box: `${CARTELLA}/BoxProdottoGiusto.tsx`, voci: `${CARTELLA}/VociProblema.tsx` };
/** I valori di `azione` che il pop-up di oggi emette (`x` e `no_grazie` chiudendo, `problema` scegliendo una voce). */
const AZIONI_DI_OGGI = ["x", "no_grazie", "problema"];

const git = (radice, ...a) => execFileSync("git", a, { cwd: radice, encoding: "utf8", maxBuffer: 1 << 24 });
const litterali = (riga) => [...riga.matchAll(/"([^"]{8,})"|`([^`]{8,})`/g)].map((m) => m[1] ?? m[2]);

/** Le righe tolte e aggiunte dal base alla copia di lavoro (`--unified=0`: solo ciò che cambia). */
function diffDal(radice, file) {
  const righe = git(radice, "diff", "--unified=0", BASE, "--", file).split("\n");
  return {
    tolte: righe.filter((r) => r.startsWith("-") && !r.startsWith("---")).map((r) => r.slice(1)),
    aggiunte: righe.filter((r) => r.startsWith("+") && !r.startsWith("+++")).map((r) => r.slice(1)),
  };
}

/** Il corpo di `classiPopup` (dalla firma alla graffa che chiude al margine). */
function corpoClassiPopup(sorgente) {
  const i = sorgente.indexOf("export function classiPopup");
  if (i < 0) return "";
  const f = sorgente.indexOf("\n}\n", i);
  return f < 0 ? "" : sorgente.slice(i, f + 3);
}

/** I SOLI ritocchi dichiarati, riga per riga (una riga tolta che non ricompare né è di classi): le firme che ricevono la proprietà nuova e
 *  la riga che sceglie i testi per aspetto. Ogni altra riga tolta è rossa. */
const RITOCCHI = {
  voci: ["export function VociProblema({ voci, onScegli, scelta, compatta = false }: Props) {"],
  box: ["export function BoxProdottoGiusto({ prodotto }: { prodotto: string }) {", "const t = TESTI_CONSULENZA.box;", "<VociProblema compatta voci={VOCI_BOX} scelta={scelta} onScegli={setScelta} />"],
  popup: ["export function PopupUscita({ prodotto }: { prodotto?: string }) {", "const t = TESTI_CONSULENZA.popup;"],
};

/** Una riga tolta è ammessa se ricompare uguale (a meno dell'indentazione) fra le aggiunte, oppure se è una riga di classi e OGNI stringa di classe
 *  (≥ 8 caratteri) ricompare uguale in una riga aggiunta (`dentro`, se dato: nel testo dato). Restituisce le righe NON ammesse. */
function nonAmmesse({ tolte, aggiunte }, ritocchi, dentro = null) {
  const aggiunteTesto = aggiunte.map((r) => r.trim()).join("\n");
  const doveCercare = dentro ?? aggiunteTesto;
  return tolte.filter((r) => {
    const t = r.trim();
    if (t === "" || ritocchi.includes(t) || aggiunteTesto.includes(t)) return false;
    const l = litterali(t);
    return !(l.length > 0 && l.every((s) => doveCercare.includes(s)));
  });
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T84b2 · POP-UP, BOX E VOCI CONDIVISI (23/11/2026)");
  const letto = (f) => readFileSync(join(radice, f), "utf8");
  const ora = { popup: letto(FILE.popup), box: letto(FILE.box), voci: letto(FILE.voci) };
  const base = Object.fromEntries(Object.entries(FILE).map(([k, f]) => [k, git(radice, "show", `${BASE}:${f}`)]));

  // ── 1 · IL SORGENTE: il diff dal base ──
  const dVoci = diffDal(radice, FILE.voci), dBox = diffDal(radice, FILE.box), dPopup = diffDal(radice, FILE.popup);
  c("VociProblema: ogni riga tolta ricompare spostata (o ha la stessa stringa di classe)", [], nonAmmesse(dVoci, RITOCCHI.voci));
  c("BoxProdottoGiusto: ogni riga tolta ricompare spostata (o ha la stessa stringa di classe)", [], nonAmmesse(dBox, RITOCCHI.box));
  c("PopupUscita: ogni riga tolta ricompare spostata, o le sue stringhe di classe stanno dentro `classiPopup`", [], nonAmmesse(dPopup, RITOCCHI.popup, corpoClassiPopup(ora.popup)));
  c("i tre file hanno davvero delle righe aggiunte (la prova non gira a vuoto)", [true, true, true], [dVoci.aggiunte.length > 0, dBox.aggiunte.length > 0, dPopup.aggiunte.length > 0]);
  c("nessuna riga tolta nel pop-up è una chiamata a `traccia`, a `setAperto` o a `setPannello` (la logica non si tocca)", [], dPopup.tolte.filter((r) => /traccia\(|setAperto\(|setPannello\(|popupPuoPartire|segnaPopupMostrato/.test(r) && !dPopup.aggiunte.some((a) => a.trim() === r.trim())));
  c("la logica del pop-up è uguale al base (effetti, `chiudi`, `scegli`, `popupPuoPartire`)", true, ["const timer = window.setTimeout(", "if (e.clientY <= 0 && !e.relatedTarget)", "popupPuoPartire({", "segnaPopupMostrato();", 'traccia("consulenza_popup_mostrato", { motivo });', 'traccia("consulenza_popup_click", { azione });', 'traccia("consulenza_popup_click", { azione: "problema", voce: voce?.etichetta ?? id });'].every((s) => base.popup.includes(s) && ora.popup.includes(s)));
  c("`VociProblema`, `BoxProdottoGiusto` e `PopupUscita` sono ancora esportati (anche `default`) con gli stessi nomi", true, ["export function VociProblema", "export function BoxProdottoGiusto", "export function PopupUscita", "export default PopupUscita", "export default BoxProdottoGiusto"].every((s) => (base.voci + base.box + base.popup).includes(s) && (ora.voci + ora.box + ora.popup).includes(s)));
  c("nessun `€`, nessun rosso del brand, nessun `bg-destructive` nelle righe aggiunte (V1-T3)", [], [...dVoci.aggiunte, ...dBox.aggiunte, ...dPopup.aggiunte].filter((r) => /€|#FF3B3B|destructive/i.test(r)));

  // ── 2 · IL DISEGNO VERO: base contro adesso ──
  const dir = mkdtempSync(join(tmpdir(), "prova-condivisi-"));
  try {
    // il base va in una cartella sua (con `PannelloProblemi` di adesso, che importa `./VociProblema`: il base)
    mkdirSync(join(dir, "base"));
    writeFileSync(join(dir, "base", "BoxProdottoGiusto.tsx"), base.box);
    writeFileSync(join(dir, "base", "VociProblema.tsx"), base.voci);
    writeFileSync(join(dir, "base", "PannelloProblemi.tsx"), letto(`${CARTELLA}/PannelloProblemi.tsx`));
    const VOCI_BASE = join(dir, "base", "VociProblema.tsx"), BOX_BASE = join(dir, "base", "BoxProdottoGiusto.tsx");
    const html = async (file, nome, props) => (await rendiComponente(radice, file, nome, props, {})).html;

    const voci = [
      { id: "tenuta", etichetta: "Tenuta: si stacca presto" },
      { id: "annoda", etichetta: "Si annoda: in doccia o al mare" },
      { id: "scolorisce", etichetta: "Si scolorisce: il colore cambia" },
      { id: "altro", etichetta: "Altro" },
    ];
    const noop = () => {};
    const combinazioni = [];
    for (const compatta of [undefined, false, true]) for (const scelta of [undefined, null, "annoda"]) combinazioni.push({ voci, onScegli: noop, ...(compatta === undefined ? {} : { compatta }), ...(scelta === undefined ? {} : { scelta }) });
    const confronti = [];
    for (const p of combinazioni) {
      const prima = await html(VOCI_BASE, "VociProblema", p);
      confronti.push({
        etichetta: `compatta=${p.compatta} scelta=${p.scelta}`,
        senza: (await html(join(radice, FILE.voci), "VociProblema", p)) === prima,
        scura: (await html(join(radice, FILE.voci), "VociProblema", { ...p, variante: "scura" })) === prima,
        // chiara vale per i tasti compatti (il box): la lista grande sta nel pannello, sempre scuro
        chiaraGrande: p.compatta ? true : (await html(join(radice, FILE.voci), "VociProblema", { ...p, variante: "chiara" })) === prima,
        chiaraDiversa: p.compatta ? (await html(join(radice, FILE.voci), "VociProblema", { ...p, variante: "chiara" })) !== prima : true,
      });
    }
    c("VociProblema, 9 combinazioni: senza proprietà l'HTML è IDENTICO al base", [], confronti.filter((x) => !x.senza).map((x) => x.etichetta));
    c("VociProblema: `variante=\"scura\"` è identico al base in tutte le combinazioni", [], confronti.filter((x) => !x.scura).map((x) => x.etichetta));
    c("VociProblema: `variante=\"chiara\"` cambia i tasti compatti; la lista grande (pannello) resta com'è", [], confronti.filter((x) => !x.chiaraGrande || !x.chiaraDiversa).map((x) => x.etichetta));

    const compatta = { voci, onScegli: noop, compatta: true };
    const chiaraSenza = await html(join(radice, FILE.voci), "VociProblema", { ...compatta, variante: "chiara" });
    const chiaraScelta = await html(join(radice, FILE.voci), "VociProblema", { ...compatta, scelta: "annoda", variante: "chiara" });
    const vietatoSuChiaro = /text-white|bg-white\/|border-white|#0a1a3a|text-brand\b|border-brand/g;
    c("voci chiare: nessun bianco su bianco (niente `text-white`, `bg-white/…`, `border-white`, fondo blueprint)", [[], [], 2], [chiaraSenza.match(vietatoSuChiaro) ?? [], chiaraScelta.replace(/text-white/g, "").match(vietatoSuChiaro) ?? [], (chiaraScelta.match(/text-white/g) ?? []).length]);
    c("voci chiare: testo notte `#0A1430` su fondo chiaro, tocco da 44 px, anello azzurro visibile sul chiaro", [true, true, true], [chiaraSenza.includes("text-[#0A1430]"), chiaraSenza.includes("min-h-11"), chiaraSenza.includes("focus-visible:ring-[#006CC4]") && chiaraSenza.includes("ring-offset-white")]);
    c("voci chiare, nessuna scelta: nessuna spunta e nessun tasto premuto", [0, 0], [(chiaraSenza.match(/<svg/g) ?? []).length, (chiaraSenza.match(/aria-pressed="true"/g) ?? []).length]);
    c("voci chiare, una scelta: UNA spunta e UN tasto premuto (selezionato = riempimento notte + spunta, non solo colore)", [1, 1, true], [(chiaraScelta.match(/<svg/g) ?? []).length, (chiaraScelta.match(/aria-pressed="true"/g) ?? []).length, /<button[^>]*aria-pressed="true"[^>]*class="[^"]*bg-\[#0A1430\][^"]*text-white/.test(chiaraScelta) || /<button[^>]*class="[^"]*bg-\[#0A1430\][^"]*"[^>]*aria-pressed="true"/.test(chiaraScelta)]);
    c("voci chiare: le etichette intere restano per chi non vede (`aria-label`) e le teste sono le stesse", [true, true], [voci.every((v) => chiaraSenza.includes(`aria-label="${v.etichetta}"`)), ["Tenuta", "Si annoda", "Si scolorisce", "Altro"].every((t) => chiaraSenza.includes(t))]);

    // il box: `prodotto` e basta, come oggi
    const props = { prodotto: "Patch di prova Alfa" };
    const boxBase = await html(BOX_BASE, "BoxProdottoGiusto", props);
    const boxOra = join(radice, FILE.box);
    c("BoxProdottoGiusto senza proprietà: HTML IDENTICO al base (e non è vuoto)", [true, true], [(await html(boxOra, "BoxProdottoGiusto", props)) === boxBase, boxBase.length > 500]);
    c("BoxProdottoGiusto `variante=\"scura\"`: HTML IDENTICO al base", true, (await html(boxOra, "BoxProdottoGiusto", { ...props, variante: "scura" })) === boxBase);
    const boxChiaro = await html(boxOra, "BoxProdottoGiusto", { ...props, variante: "chiara" });
    c("BoxProdottoGiusto chiaro: card chiara, nessun bianco su bianco, nessun blu pieno, nessun rosso", [[], false, false], [boxChiaro.match(/text-white|bg-white\/|border-white|#0a1a3a|bg-brand-scuro|destructive|FF3B3B/g) ?? [], boxChiaro === boxBase, !/<section[^>]*class="[^"]*bg-white/.test(boxChiaro)]);
    c("BoxProdottoGiusto chiaro: bottone di CONTORNO (bordo notte, testo notte, fondo trasparente), alto 48 px, anello azzurro su chiaro", [true, true, true, true], [/<button[^>]*class="[^"]*border-2 border-\[#0A1430\][^"]*"/.test(boxChiaro), /<button[^>]*class="[^"]*text-\[#0A1430\][^"]*"/.test(boxChiaro), /<button[^>]*class="[^"]*\bh-12\b/.test(boxChiaro), boxChiaro.includes("focus-visible:ring-[#006CC4]")]);
    c("BoxProdottoGiusto chiaro: 7 voci compatte (come oggi, con le stesse etichette) + il bottone; titolo e sezione collegati", [true, true, true], [(boxChiaro.match(/<li/g) ?? []).length === (boxBase.match(/<li/g) ?? []).length && (boxChiaro.match(/<li/g) ?? []).length === 7, (boxChiaro.match(/<button/g) ?? []).length === 8, /aria-labelledby="box-giusto-titolo"/.test(boxChiaro) && /id="box-giusto-titolo"/.test(boxChiaro)]);
    c("BoxProdottoGiusto chiaro: titolo, testo e bottone sono quelli del documento dello shop («Parlane con noi, gratis»), non quelli della landing", [true, true, false], [boxChiaro.includes("Parlane con noi, gratis"), boxChiaro.includes("Succede. Se la tua patch si stacca presto"), boxChiaro.includes("Parlane con noi, è gratuito")]);
    c("BoxProdottoGiusto scuro: il testo di oggi, invariato", [true, false], [boxBase.includes("Parlane con noi, è gratuito"), boxBase.includes("Succede.")]);
    c("BoxProdottoGiusto chiaro: nessuna parola vietata né cifra nel testo (V1-T6)", [], (boxChiaro.replace(/<[^>]*>/g, " ").replace(/&#x27;|&quot;|&amp;/g, " ").match(/€|\d|\bcura\b|ricrescita|definitiv|garantit|guarisc|trustpilot/gi) ?? []));

    // ── 3 · LA PARTE PURA DEL POP-UP E IL VALORE DI `azione` (una sonda, in una cartella sua) ──
    mkdirSync(join(dir, "sonda"));
    const fileSonda = join(dir, "sonda", "Sonda.tsx");
    writeFileSync(fileSonda, `import * as P from ${JSON.stringify(join(radice, FILE.popup))};
export function Sonda() {
  const x = { oggi: P.classiPopup("oggi"), shop: P.classiPopup("shop"), altro: P.classiPopup("boh" as any), azione: P.AZIONE_POPUP_CONSULENZA, esportati: Object.keys(P).sort() };
  return <script type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }} />;
}
`);
    const sonda = JSON.parse((await rendiComponente(radice, fileSonda, "Sonda", {}, {})).html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
    const { oggi, shop } = sonda;
    const classiBase = [...base.popup.matchAll(/className="([^"]+)"/g)].map((m) => m[1]).filter((x) => x !== "min-w-0" && x !== "h-5 w-5");
    c("classiPopup è esportata (pura) e `PopupUscita` e `default` restano", true, ["classiPopup", "AZIONE_POPUP_CONSULENZA", "PopupUscita", "default"].every((k) => sonda.esportati.includes(k)));
    c("classiPopup(\"oggi\"): ESATTAMENTE le stringhe di classe del base, una per una, nello stesso ordine di scrittura", classiBase, [oggi.sfondo, oggi.finestra, oggi.testa, oggi.titolo, oggi.testo, oggi.chiudi, oggi.corpo, oggi.rifiuto]);
    c("classiPopup(\"oggi\"): ogni stringa sta nel base byte per byte (e nessuna è vuota)", [], Object.values(oggi).filter((s) => s !== "" && !base.popup.includes(`"${s}"`) && !base.popup.includes(`className="${s}"`) && !base.popup.includes(s)));
    c("classiPopup(\"oggi\") non porta lo stile del bottone nuovo (il pop-up di oggi non ha il bottone)", "", oggi.consulenza);
    c("classiPopup è una funzione pura: stessa risposta alla seconda chiamata, ogni aspetto sconosciuto vale «oggi»", [true, true], [JSON.stringify(sonda.altro) === JSON.stringify(oggi), JSON.stringify(oggi) !== JSON.stringify(shop)]);
    c("classiPopup(\"shop\"): fondo blueprint al posto del navy fisso, bottone blu pieno della consulenza, tocchi da 44 px", [true, false, true, true, true], [shop.finestra.includes("bg-blueprint"), shop.finestra.includes("bg-[#0a1a3a]"), shop.consulenza.includes("bg-brand-scuro") && shop.consulenza.includes("text-white"), /\bh-12\b|min-h-12/.test(shop.consulenza) && /min-h-11/.test(shop.rifiuto), shop.chiudi.includes("h-11") && shop.chiudi.includes("w-11")]);
    c("classiPopup(\"shop\"): lo sfondo scurito e il fuoco visibile sul blueprint (anello bianco o azzurro del marchio)", [true, true], [shop.sfondo.includes("bg-black/70"), /focus-visible:ring-(white|brand)/.test(shop.consulenza) && /focus-visible:ring-(white|brand)/.test(shop.rifiuto) && /focus-visible:ring-(white|brand)/.test(shop.chiudi)]);
    c("classiPopup(\"shop\"): solo un bottone pieno (la consulenza): «No, grazie» è un link senza fondo, né rosso né blu pieno", [true, false], [!/\bbg-/.test(shop.rifiuto.replace(/hover:bg-[^\s]+/g, "")), /destructive|FF3B3B|bg-brand-scuro/.test(Object.values(shop).filter((s) => s !== shop.consulenza).join(" "))]);
    c("classiPopup(\"shop\"): niente movimento con `prefers-reduced-motion` (come oggi)", true, shop.finestra.includes("motion-reduce:animate-none") && shop.sfondo.includes("motion-reduce:animate-none"));

    // ── 4 · L'EVENTO: valore nuovo e distinto ──
    const azione = sonda.azione;
    c("`azione` del pop-up nuovo: una parola non vuota", true, typeof azione === "string" && /^[a-z_]{3,}$/.test(azione));
    c("…distinta da tutti i valori di oggi («x», «no_grazie», «problema»)", [], AZIONI_DI_OGGI.filter((v) => v === azione));
    c("…e da ogni identificativo di voce (la voce viaggia a parte, in `voce`)", [], ["tenuta", "annoda", "scolorisce", "svuota", "altro", "si_stacca", "si_vede"].filter((v) => v === azione));
    const dettagli = [...ora.popup.matchAll(/traccia\("consulenza_popup_click", \{([^}]*)\}\)/g)].map((m) => m[1].trim());
    c("il pop-up ha tre punti che emettono `consulenza_popup_click`: i due di oggi (invariati) e quello nuovo con `azione`", [true, true, true, 3], [dettagli.includes("azione"), dettagli.some((d) => d.startsWith('azione: "problema"')), dettagli.includes("azione: AZIONE_POPUP_CONSULENZA"), dettagli.length]);
    c("il click su «Consulenza gratuita» emette l'evento, chiude il pop-up e apre il pannello esistente (`PannelloProblemi`, nessun problema scelto)", true, /const consulenza = \(\) => \{\s*traccia\("consulenza_popup_click", \{ azione: AZIONE_POPUP_CONSULENZA \}\);\s*setAperto\(false\);\s*setPannello\(\{ aperto: true, problema: null \}\);\s*\};/.test(ora.popup));
    c("il bottone nuovo chiama proprio quel gestore, e il rifiuto («No, grazie») resta `chiudi(\"no_grazie\")`", [true, true], [/onClick=\{consulenza\}/.test(ora.popup), /onClick=\{\(\) => chiudi\("no_grazie"\)\}/.test(ora.popup)]);
    c("`aspetto=\"shop\"`: l'elenco delle voci NON è nel pop-up (D85): `VociProblema` compare una volta sola, nel ramo «oggi»", [1, true], [(ora.popup.match(/<VociProblema/g) ?? []).length, /\{shop \? \(\s*<button type="button" onClick=\{consulenza\}[^>]*>[\s\S]*?\) : \(\s*<VociProblema compatta voci=\{PROBLEMI\} onScegli=\{scegli\} \/>\s*\)\}/.test(ora.popup)]);
    c("i testi del pop-up nuovo vengono da `TESTI_SHOP.popup` («Prima di andare»…), quelli di oggi da `TESTI_CONSULENZA.popup`", [true, true], [/TESTI_SHOP\.popup/.test(ora.popup), /TESTI_CONSULENZA\.popup/.test(ora.popup)]);
    c("`PopupUscita` ha il valore di partenza `aspetto = \"oggi\"` e `BoxProdottoGiusto`/`VociProblema` `variante = \"scura\"`", [true, true, true], [/aspetto = "oggi"/.test(ora.popup), /variante = "scura"/.test(ora.box), /variante = "scura"/.test(ora.voci)]);

    // ── 5 · IL POP-UP COL DIALOGO CHIUSO NON DISEGNA NULLA (in nessun aspetto) ──
    const stato = { pathname: "/shop/prodotto/prova" };
    c("PopupUscita col dialogo chiuso: nessun byte (di oggi, nuovo, e con proprietà sconosciuta)", ["", "", ""], [
      (await rendiComponente(radice, join(radice, FILE.popup), "PopupUscita", { prodotto: "Patch di prova Alfa" }, stato)).html,
      (await rendiComponente(radice, join(radice, FILE.popup), "PopupUscita", { prodotto: "Patch di prova Alfa", aspetto: "shop" }, stato)).html,
      (await rendiComponente(radice, join(radice, FILE.popup), "PopupUscita", {}, stato)).html,
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
