/** ── VETRINA V1 · T85 · CARD, GRIGLIA, FIDUCIA, «TI SERVE ANCHE» ─────────────
 *  Parte 1 (commit a parte): `SnapRiga.foto` accetta le misure della card (480 e 960, senza 1600): la card mette nel carrello una riga la
 *  cui foto non ha la 1600, e le righe già salvate (con la 1600) devono restare valide (nota del revisore di T76, osservazione 1).
 *  Dati inventati di `_dati-vetrina.mjs`, nessuna rete. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARRELLO_NUOVO, CATALOGO, righeServerDi, rigaCms } from "./_dati-vetrina.mjs";

const copia = (x) => structuredClone(x);

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T85 · LA RIGA DEL CARRELLO CON LA FOTO DELLA CARD (23/11/2026)");
  const K = mod["shop/cms/carrello"];
  const V = mod["shop/cms/vetrina-carrello"];

  // ── il tipo: SnapRiga.foto = MisureFoto | null (nel sorgente: i tipi non esistono quando gira la prova) ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/carrello.ts"), "utf8");
  const snap = sorgente.match(/export interface SnapRiga \{[\s\S]*?\n\}/)?.[0] ?? "";
  c("SnapRiga.foto è MisureFoto | null (la card non ha la 1600)", true, /foto: MisureFoto \| null;/.test(snap));
  c("…e non pretende più SrcFoto per la foto della riga", false, /SrcFoto/.test(snap));

  // ── una riga come la mette la card: foto solo 480 e 960 ──
  const alfa = CATALOGO.find((p) => p.slug === "patch-prova-alfa");
  const principale = alfa.media.find((m) => m.slot === "principale").src;
  const dallaCard = { ...rigaCms(alfa, 0, 1), snap: { ...rigaCms(alfa, 0, 1).snap, foto: { w480: principale.w480, w960: principale.w960 } } };
  const vecchiaSalvata = copia(CARRELLO_NUOVO[0]); // salvata prima: ha la 1600
  c("la riga già salvata ha la foto con la 1600", true, typeof vecchiaSalvata.snap.foto.w1600 === "string");
  const server = righeServerDi([dallaCard.sku]);
  const pulita = K.ripulisciRighe([vecchiaSalvata, dallaCard], [...server, ...righeServerDi([vecchiaSalvata.sku])]);
  c("ripulisciRighe: tutte e due restano, nessuna rimossa", [2, 0], [pulita.righe.length, pulita.rimosse]);
  const vista = V.righeVista([vecchiaSalvata, dallaCard], "ok");
  c("la vista: la foto della riga vecchia resta intera, con la 1600", principale, vista.righe[0].foto);
  c("la vista: la foto della riga della card è quella della card, senza una 1600 inventata", { w480: principale.w480, w960: principale.w960 }, vista.righe[1].foto);
  c("il totale non cambia per la foto", K.totaleDaRighe([vecchiaSalvata]), K.totaleDaRighe([{ ...vecchiaSalvata, snap: { ...vecchiaSalvata.snap, foto: { w480: principale.w480, w960: principale.w960 } } }]));
}
