/** ── LE PROVE DEI MESSAGGI AUTOMATICI · l'ingresso ────────────────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici. `prove/manychat.mjs` chiama
 *  `proveMessaggiAutomatici(mod, aiuti)` (una riga, messa dal compito T1): qui si
 *  chiamano, in ordine, i file d'area di `prove/messaggi-automatici/`.
 *
 *  ⚠️ UN FILE PER COMPITO. Nessun compito dopo T1 tocca questo file, `prove/prove.mjs` o
 *   `prove/manychat.mjs`: scrive nel suo file d'area (un file ancora vuoto passa).
 *   Il catalogo e la migrazione (T1) sono in `catalogo.mjs`; T2 → `registro`, `adattatore`;
 *   T3 → `porta`; T4 → `giro`; T5 → `invii`; T6 → `webinar`; T7 → `vista`; T8 → `scansione`.
 *  ⚠️ `aiuti` = { c, gruppo, radice }: vedi `prove/manychat.mjs`.
 *  ───────────────────────────────────────────────────────────────────────── */
import { proveCatalogoMessaggi } from "./messaggi-automatici/catalogo.mjs";
import { proveRegistroMessaggi } from "./messaggi-automatici/registro.mjs";
import { proveAdattatoreMessaggi } from "./messaggi-automatici/adattatore.mjs";
import { provePortaMessaggi } from "./messaggi-automatici/porta.mjs";
import { proveGiroMessaggi } from "./messaggi-automatici/giro.mjs";
import { proveInviiMessaggi } from "./messaggi-automatici/invii.mjs";
import { proveWebinarMessaggi } from "./messaggi-automatici/webinar.mjs";
import { proveVistaMessaggi } from "./messaggi-automatici/vista.mjs";
import { proveScansioneMessaggi } from "./messaggi-automatici/scansione.mjs";

export async function proveMessaggiAutomatici(mod, aiuti) {
  await proveCatalogoMessaggi(mod, aiuti);
  await proveRegistroMessaggi(mod, aiuti);
  await proveAdattatoreMessaggi(mod, aiuti);
  await provePortaMessaggi(mod, aiuti);
  await proveGiroMessaggi(mod, aiuti);
  await proveInviiMessaggi(mod, aiuti);
  await proveWebinarMessaggi(mod, aiuti);
  await proveVistaMessaggi(mod, aiuti);
  await proveScansioneMessaggi(mod, aiuti);
}
