/** ── FATTURE DALLA CHAT · IL PAGAMENTO SCRITTO A MANO (pagamento-manuale.ts) ──
 *  Commessa 2026-11-13-fatture-dalla-chat, T11.2 (SPEC §9.3 passo 7, §9.7
 *  criterio 3; PIANO §3bis, T11.2). Via 2 (SPEC §9): qui, a differenza della
 *  Via 1 e della bulk pura, il titolare può scrivere a mano i 4 campi del
 *  pagamento (importo, data, modo, riferimento) SENZA nessuno screenshot — lo
 *  screenshot resta facoltativo (SPEC §9.3 passo 7).
 *
 *  Una sola funzione pura: dai 4 campi grezzi a una `LetturaPagamento` valida,
 *  pronta per `rigaSinteticaDa` (T3, non toccata) — da lì in poi `esaminaRiga`
 *  (bulk, non toccata) valuta la riga esattamente come un pagamento letto da
 *  uno screenshot, perché il TIPO è lo stesso: zero codice nuovo in quel punto.
 *
 *  ⚠️ Niente rete, niente database: nessun controllo qui duplica quelli già
 *  fatti da `bulk/regole-riga.ts` (`importo_non_valido`, `data_non_valida`,
 *  `data_futura`, `modo_non_ammesso`…) — quelli restano gli UNICI che decidono
 *  se la riga è «pronta» o «da controllare». Qui si controlla solo che
 *  l'INPUT grezzo (dal corpo della richiesta) sia nella forma minima che
 *  SERVE per costruire l'oggetto: importo intero positivo, data di un giorno
 *  che esiste davvero nel calendario, modo nell'elenco chiuso
 *  `MetodoPagamento` (mai un bonifico di ripiego). Un valore che non supera
 *  questo controllo non vale un bonifico malletto: è un INPUT scartato,
 *  `richiesta_non_valida`, zero scritture (chi chiama, `chat.server.ts`).
 *
 *  ⚠️ Il riferimento è l'UNICO campo facoltativo (`modi-di-incasso.ts`: «IL
 *  DATO NON È MAI OBBLIGATORIO» — una fattura senza CRO è comunque valida). */
import type { MetodoPagamento } from "../modi-di-incasso";
import { MODI_INCASSO } from "../modi-di-incasso";
import type { LetturaPagamento } from "../bulk/tipi";

/** I 4 campi scritti a mano, come arrivano (già controllati in FORMA dal chiamante — numero/
 *  stringa/lunghezza — ma non ancora nel CONTENUTO: lo fa questa funzione). */
export interface PagamentoManuale {
  importo: unknown;
  data: unknown;
  modo: unknown;
  riferimento: unknown;
}

const modoValido = (m: string): m is MetodoPagamento => MODI_INCASSO.some((x) => x.chiave === m);

/** AAAA-MM-GG di un giorno che esiste DAVVERO (niente 31 febbraio): stesso controllo minimo di
 *  `giornoIso` in `chat.server.ts` (riscritto qui apposta — è una riga generica di calendario, non
 *  una regola fiscale, stesso principio di duplicazione già scelto più volte in questa cartella). */
function giornoVero(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Il riferimento ripulito: via caratteri di controllo e parentesi angolari/graffe (un CRO non ne
 *  ha bisogno; un'iniezione dentro il campo spesso sì), tagliato a 120 caratteri — stessa disciplina
 *  di `pulito()` in `lettura-chat.ts` (riscritta qui: generica, non logica di fatturazione). */
function riferimentoPulito(v: unknown): string {
  return String(v ?? "")
    .replace(/[\s\u0000-\u001f\u007f-\u009f<>{}]+/g, " ")
    .trim()
    .slice(0, 120);
}

/** `{importo, data, modo, riferimento}` grezzi → una `LetturaPagamento` valida, o `null` se uno dei
 *  3 campi obbligatori non supera il controllo minimo (il chiamante risponde `richiesta_non_valida`,
 *  zero scritture). Il riferimento, da solo, non può mai far fallire la costruzione. */
export function pagamentoManualeValido(v: PagamentoManuale): LetturaPagamento | null {
  const importo = v.importo;
  if (typeof importo !== "number" || !Number.isFinite(importo) || !Number.isInteger(importo))
    return null;
  if (importo <= 0) return null;
  const data = typeof v.data === "string" ? v.data : "";
  if (!giornoVero(data)) return null;
  const modo = typeof v.modo === "string" ? v.modo : "";
  if (!modoValido(modo)) return null;
  return {
    tipo: "pagamento",
    importo,
    importoAltro: null,
    valuta: "EUR",
    esito: "completato",
    data,
    meseGiorno: "",
    dataTesto: data,
    annoVisibile: true,
    formatoAmbiguo: false,
    modo,
    modoIncerto: false,
    riferimento: riferimentoPulito(v.riferimento),
    paganteCognome: "",
    incerti: [],
  };
}
