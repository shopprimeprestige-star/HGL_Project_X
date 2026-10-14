/** ── LA REGISTRAZIONE FINISCE SUL COMPUTER, NON NELL'APP ───────────────────
 *
 *  Richiesta del committente (14/10/2026): «fai che dopo la consulenza le
 *  scarica direttamente sul computer, non le salva dentro l'app. Così le ho e
 *  le posso caricare su Google Drive se voglio».
 *
 *  Da qui in poi la consulenza si registra in UN file solo (niente più parti
 *  da 40 MB: quelle esistevano per il tetto di Supabase, che non c'entra più)
 *  e a fine consulenza il browser lo mette nei Download.
 *
 *  ⚠️ IL NOME DEL FILE SI RICONOSCE IN UNA CARTELLA: data e ora ITALIANE (non
 *   quelle di Greenwich, che sbagliavano di due ore) e il nome del cliente.
 *   Il file è sul computer del consulente, non viaggia: il nome può starci.
 *  ───────────────────────────────────────────────────────────────────────── */

const due = (n: number) => String(n).padStart(2, "0");

/** «Mario Rossì» → «Mario-Rossi»: niente caratteri che una cartella rifiuta. */
export function perNomeFile(t: string): string {
  return String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Il nome del file. `quando` si legge nell'ora del computer (quella italiana
 *  per chi lavora in Italia); `parte` > 1 solo se un file enorme si è dovuto
 *  chiudere a metà (oltre 1,5 GB). */
export function nomeRegistrazione(p: { quando: Date; cliente?: string; parte?: number; ext: string }): string {
  const d = p.quando;
  const data = `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}-${due(d.getHours())}-${due(d.getMinutes())}`;
  const chi = perNomeFile(p.cliente || "");
  const parte = p.parte && p.parte > 1 ? `-parte${p.parte}` : "";
  return `meetly-${data}${chi ? `-${chi}` : ""}${parte}.${p.ext}`;
}
