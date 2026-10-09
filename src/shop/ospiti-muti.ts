/** ── CHI HA IL MICROFONO SPENTO DAL CONSULENTE ─────────────────────────────
 *
 *  Lo stato del microfono di un ospite NON viaggia nel roster: il consulente
 *  manda l'ordine («force mic off») e il dispositivo obbedisce, ma nessuno lo
 *  racconta indietro. Chi disegna un interruttore deve quindi ricordarsi da sé
 *  che cosa ha ordinato, se no il pulsante dice sempre la stessa cosa e non è
 *  un interruttore: è un bottone che spegne due volte.
 *
 *  ⚠️ E LA MEMORIA DEVE ESSERE UNA SOLA. Finora stava dentro il pannello
 *   «Partecipanti» (`useState` locale). Adesso gli stessi comandi stanno anche
 *   nel menu che si apre tenendo premuto sulla camera: due memorie separate
 *   vorrebbero dire due interruttori che si contraddicono — muti dalla camera,
 *   e il pannello continua a scrivere «Microfono» come se fosse acceso. Chi
 *   guarda i due non capisce più quale dice la verità.
 *
 *  ⚠️ Chi esce dalla stanza si dimentica: se rientra, rientra col microfono
 *   suo — noi non possiamo più imporgli niente, e ricordarcelo vorrebbe dire
 *   mostrare «muto» su una persona che ci sta parlando.
 *  ───────────────────────────────────────────────────────────────────────── */

const muti = new Set<string>();
const ascolti = new Set<() => void>();

const avvisa = () => { for (const f of [...ascolti]) { try { f(); } catch { /* un ascoltatore rotto non ferma gli altri */ } } };

/** Questo ospite l'ho silenziato io? */
export const eMuto = (pid: unknown): boolean => muti.has(String(pid ?? ""));

/** Lo silenzio (o gli ridò la voce). Ritorna com'è adesso. */
export function segnaMuto(pid: unknown, muto: boolean): boolean {
  const p = String(pid ?? "");
  if (!p) return false;
  if (muto === muti.has(p)) return muto;
  if (muto) muti.add(p); else muti.delete(p);
  avvisa();
  return muto;
}

/** L'interruttore: ritorna lo stato NUOVO (true = adesso è muto). */
export const scambiaMuto = (pid: unknown): boolean => segnaMuto(pid, !eMuto(pid));

/** Chi è uscito dalla stanza non è più muto: rientrando comanda lui. */
export function dimenticaMuto(pid: unknown) { segnaMuto(pid, false); }

/** Tiene l'elenco pulito: chi non è più in stanza esce anche da qui. */
export function soloQuestiRestano(pids: unknown[]) {
  const vivi = new Set(pids.map((p) => String(p ?? "")));
  let cambiato = false;
  for (const p of [...muti]) if (!vivi.has(p)) { muti.delete(p); cambiato = true; }
  if (cambiato) avvisa();
}

/** Per le prove e per chi vuole guardare tutto l'elenco. */
export const elencoMuti = (): string[] => [...muti].sort();

/** Chi disegna un interruttore vuole saperlo appena cambia. */
export function ascoltaMuti(f: () => void): () => void {
  ascolti.add(f);
  return () => { ascolti.delete(f); };
}
