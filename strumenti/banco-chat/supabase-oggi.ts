/** Supabase finto per il banco «Oggi»: ogni richiesta risponde vuota, tranne le cose da fare scritte a mano. */
import { oggiIso } from "../../src/crm/ui";

const giorno = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return oggiIso(d);
};
const t = (id: string, testo: string, data: string, di: string, diNome: string, ora = "") => ({
  id, testo, data, ora, di, diNome, creata: "2026-01-01T08:00:00.000Z",
});
const TASK = [
  t("a", "Preparare le slide del meet", giorno(0), "m", "Mirko", "09:30"),
  t("b", "Richiamare lo studio per il preventivo", giorno(0), "m", "Mirko"),
  t("c", "Mandare il contratto firmato", giorno(0), "f", "Filippo", "15:00"),
  t("d", "Controllare il listino aggiornato", giorno(-1), "m", "Mirko"),
  t("e", "Chiamare il fornitore", giorno(-1), "f", "Filippo"),
  t("g", "Inviare il riepilogo della settimana", giorno(-3), "m", "Mirko"),
  t("h", "Ordinare i campioni", giorno(1), "m", "Mirko"),
];
function q(tabella: string): unknown {
  const esito = { data: tabella === "app_config" ? { value: JSON.stringify({ v: 1, task: TASK }) } : [], error: null };
  const p: unknown = new Proxy(() => p, {
    get: (_, k) => (k === "then" ? (ok: (v: unknown) => unknown) => Promise.resolve(esito).then(ok) : () => p),
  });
  return p;
}
export const supabase = new Proxy({}, {
  get: (_, k) => (k === "from" ? q : () => new Proxy({}, { get: () => () => ({ unsubscribe() {} }) })),
});
