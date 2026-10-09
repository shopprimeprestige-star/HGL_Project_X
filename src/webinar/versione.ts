import { useEffect, useState } from "react";

/** ── QUESTA PAGINA STA GIRANDO L'ULTIMA VERSIONE? ──────────────────────────
 *
 *  ⚠️ È IL PROBLEMA CHE CI HA FATTO PERDERE PIÙ TEMPO DI TUTTI. Ogni
 *   pubblicazione cambia il nome dei file, ma una scheda già aperta continua a
 *   far girare quelli di prima finché non la si ricarica — e la REGIA è
 *   l'unica scheda che non si ricarica mai, perché ricaricandola si esce dalla
 *   diretta. Il risultato è che una correzione veniva provata sulla versione
 *   vecchia, sembrava non funzionare, si andava a cercarne la causa nel
 *   programma, e la causa era la scheda. È successo più volte di seguito.
 *
 *  ⚠️ NON SI RICARICA DA SOLI, e non è timidezza: ricaricare la regia in mezzo
 *   a un webinar butta chi conduce fuori dalla diretta davanti a duecento
 *   persone. Si dice che c'è, e si dice anche quanto costa premere. Decide lui
 *   quando.
 *
 *  Il confronto è sul nome del file d'ingresso: l'indirizzo della pagina si
 *  richiede senza cache e si guarda se cita ancora lo stesso.
 */

/** Il nome del file d'ingresso citato in una pagina. Stringa vuota se non c'è
 *  — e in quel caso non si conclude niente: meglio tacere che dire «versione
 *  vecchia» a chi ha l'ultima. */
export function ingressoDaHtml(html: string): string {
  const m = /\/assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(String(html || ""));
  return m ? m[1] : "";
}

/** `true` solo quando si sa DAVVERO che sono diversi.
 *  ⚠️ Due stringhe vuote non sono «uguali»: sono «non lo so», e non devono
 *   accendere nessun avviso. Un avviso che compare per sbaglio insegna a
 *   ignorarlo, e quando poi serve non lo guarda più nessuno. */
export function versioneVecchia(qui: string, pubblicata: string): boolean {
  if (!qui || !pubblicata) return false;
  return qui !== pubblicata;
}

/** ── ⚠️ IL RIPIEGO: LA PAGINA VECCHIA SI PRESENTA COME UN GUASTO ───────────
 *  Un codice di guasto che arriva da una pagina vecchia manda a cercare la
 *  causa dove non c'è: nel programma di adesso, non in quello che sta girando
 *  lì. È successo — è tornato un «C08» che nel codice pubblicato non può più
 *  esistere, perché adesso al codice si attacca sempre il nome dell'errore.
 *  Quindi, quando si sa che la pagina è vecchia, lo si dice PRIMA di qualunque
 *  altra spiegazione: è l'unica che le comprende tutte.
 */
export const AVVISO_VECCHIA =
  "Questa pagina sta girando una versione vecchia: ricaricala e riprova.";

/** ── LA SPIA, PRONTA DA USARE ──────────────────────────────────────────────
 *  ⚠️ Sta qui e non in ciascuna pagina perché serve in due posti — la regia e
 *   la sala — e due copie dello stesso controllo vuol dire, il giorno che una
 *   cambia, due risposte diverse alla stessa domanda.
 *  ⚠️ Ogni due minuti: una pubblicazione non capita due volte al minuto, e
 *   questa richiesta scarica una pagina intera.
 */
export function useVersioneVecchia(): boolean {
  const [vecchia, setVecchia] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const mia = ingressoDaHtml(document.documentElement.outerHTML);
    if (!mia) return;
    let vivo = true;
    const guarda = async () => {
      try {
        const r = await fetch(window.location.pathname, { cache: "no-store" });
        const html = await r.text();
        if (vivo) setVecchia(versioneVecchia(mia, ingressoDaHtml(html)));
      } catch { /* senza rete non si conclude niente */ }
    };
    void guarda();
    const t = setInterval(() => void guarda(), 120_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  return vecchia;
}
