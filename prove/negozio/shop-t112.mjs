/** ── VETRINA V1 · T112 · ultime due correzioni del collaudo R4 (23/11/2026) ───────────────────────────────────────────────────
 *  Qui si legge il sorgente (senza commenti). Le misure vere (Chrome, 1280 con banner e barra; 320 al 200 %) sono prese a mano con un banco fuori dal repository.
 *  · T112-1 (R4-1): categoria a 1280 con il banner aperto: «Disponibile», in fondo ai filtri, restava sotto la barra consulenza (93 %). Il pannello è `sticky`, il browser non lo scorre:
 *    la sua altezza massima ora toglie anche `--barra-h` (banner + barra), così il pannello scorre da solo e nessun controllo finisce sotto la barra.
 *    Senza barra e senza banner `--barra-h` vale 0 e la misura è quella di prima (`100dvh - 7rem`).
 *  · T112-2 (R4-2): riepilogo del carrello a 320 al 200 %: la riga «Spedizione / 5,90 €» usciva dal riquadro e «Vai alla cassa» andava su 3 righe fuori dal bottone (altezza fissa). */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T112 · FILTRI SOTTO LA BARRA E RIEPILOGO A 320 AL 200 % (23/11/2026)");
  const leggi = (f) => senzaCommenti(readFileSync(join(radice, "src/components/shop", f), "utf8"));

  // ── T112-1: l'altezza del pannello filtri tiene conto di banner e barra
  const filtri = leggi("categoria/FiltriCategoria.tsx");
  const aside = (filtri.match(/<aside[^>]*>/) ?? [""])[0];
  c("T112-1: il pannello filtri toglie `--barra-h` dall'altezza massima (e scorre da solo)", [true, true], [
    aside.includes("lg:max-h-[calc(100dvh-7rem-var(--barra-h,0px))]"), aside.includes("lg:overflow-y-auto")]);
  c("T112-1: resta sticky a `top-24` (senza barra e banner la resa è quella di prima) e la vecchia misura senza barra non c'è più", [true, true, false], [
    aside.includes("lg:sticky") && aside.includes("lg:top-24"), aside.includes("lg:block"), aside.includes("lg:max-h-[calc(100dvh-7rem)]")]);

  // ── T112-2: righe del riepilogo che vanno a capo, bottone senza altezza fissa
  const riep = leggi("carrello/RiepilogoOrdine.tsx");
  const righe = riep.match(/<div className="[^"]*\bflex\b[^"]*justify-between[^"]*">/g) ?? [];
  c("T112-2: le tre righe del riepilogo (Prodotti, Spedizione, Totale) vanno a capo (`flex-wrap`)", [3, 3], [righe.length, righe.filter((r) => /\bflex-wrap\b/.test(r)).length]);
  const link = (riep.match(/<Link[\s\S]*?>/) ?? [""])[0];
  c("T112-2: «Vai alla cassa» ha `min-h-14` (non `h-14`) e il testo centrato, così a 3 righe il bottone cresce", [true, false, true], [
    /\bmin-h-14\b/.test(link), /(^|[\s"])h-14\b/.test(link), /\btext-center\b/.test(link)]);
  c("T112-2: il bottone è ancora a tutta larghezza, pieno e con il padding di prima (al 100 % e a 390 non cambia niente)", true,
    /\bw-full\b/.test(link) && /\bbg-\[#0A1430\]/.test(link) && /\bpx-6\b/.test(link) && /\bmt-4\b/.test(link));
}
