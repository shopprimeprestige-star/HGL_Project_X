/** ── «HO CAMBIATO SCHERMATA»: DETTO SUL CANALE ─────────────────────────────
 *  Il consulente cambia pagina e il cliente ci arriva all'istante, senza
 *  aspettare il giro di sicurezza. A dirlo è il motore della consulenza, che
 *  ha in mano il canale della stanza; a chiamarlo è shop/live, che la pagina
 *  la registra.
 *
 *  ⚠️ STA IN UN FILE SUO per lo stesso motivo di shop/gettone-cliente: se
 *   `shop/live` importasse il motore, il CRM — che importa `shop/live` per
 *   fare il link di un preventivo — si porterebbe dietro 254 kB di
 *   videochiamata a ogni apertura. Misurato. Vedi shop/link-ospite.
 *  ⚠️ E se nessuno l'ha riempito non succede niente: il cliente se ne accorge
 *   al giro dopo, qualche secondo più tardi. */
let dillo: ((path: string) => void) | null = null;

/** Lo registra il motore della consulenza (shop/call). */
export function registraAnnuncioPagina(f: ((path: string) => void) | null) { dillo = f; }

/** Il consulente è su una schermata nuova: chi è nella stanza lo sappia ora. */
export function annunciaPaginaCambiata(path: string) {
  try { dillo?.(path); } catch { /* il giro di sicurezza ci arriva comunque */ }
}
