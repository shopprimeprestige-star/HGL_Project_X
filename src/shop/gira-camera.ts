/** ── GIRARE LA CAMERA: DAVANTI ⇄ DIETRO ────────────────────────────────────
 *
 *  Richiesta del committente: «aggiungi un pulsante su Meetly per ruotare la
 *  videocamera agli ospiti, o anche a me presentatore: fai che posso ruotarla,
 *  ora non c'è».
 *
 *  ── A COSA SERVE DAVVERO ─────────────────────────────────────────────────
 *  In una consulenza sui capelli la cosa che si chiede più spesso al cliente è
 *  «fammi vedere dietro». Con la camera frontale non si può: il cliente
 *  dovrebbe girarsi di spalle e perdere di vista lo schermo. La camera di
 *  dietro del telefono è la risposta — ed è la stessa ragione per cui questo
 *  pulsante esiste in tutti i programmi di videochiamata.
 *  Finora si poteva solo scegliere la camera da un elenco a tendina, nelle
 *  impostazioni, e solo per sé: dall'altra parte, dove il telefono ce l'ha il
 *  cliente, non c'era niente.
 *
 *  ── COME SI DECIDE QUAL È «L'ALTRA» ──────────────────────────────────────
 *  Si guarda il NOME del dispositivo, quando c'è: i browser scrivono «front»
 *  o «back» (iPhone e Android), «anteriore»/«posteriore», «FaceTime HD» sui
 *  portatili Apple. Se il nome dice da che parte guarda, si salta alla prima
 *  camera che guarda dall'altra parte — che è quello che la persona si
 *  aspetta premendo il pulsante.
 *  ⚠️ I NOMI POSSONO MANCARE: finché non si dà il permesso il browser li
 *   nasconde, e qualcuno li nasconde comunque. In quel caso si passa
 *   semplicemente alla camera dopo, in giro: su un telefono sono due, quindi
 *   «la dopo» È l'altra.
 *  ⚠️ CON UNA CAMERA SOLA NON SI GIRA NIENTE, e si deve poterlo dire: un
 *   pulsante che non fa niente quando lo premi è peggio di un pulsante
 *   spento. (Succede su quasi tutti i computer fissi.)
 *  ───────────────────────────────────────────────────────────────────────── */

/** Una camera come la elenca il browser, ridotta al minimo che serve qui. */
export interface CameraVista {
  id: string;
  /** Il nome che il browser le dà. Può essere vuoto. */
  nome?: string;
}

export type Verso = "fronte" | "retro" | "";

const PAROLE_FRONTE = ["front", "anterior", "user", "selfie", "facetime", "frontale", "interna"];
const PAROLE_RETRO = ["back", "rear", "posterior", "environment", "retro", "esterna", "ultra wide", "grandangol", "teleobiett"];

/** Da che parte guarda questa camera, se il nome lo dice. */
export function versoCamera(nome?: string | null): Verso {
  const s = String(nome || "").toLowerCase();
  if (!s) return "";
  //  ⚠️ Prima il retro: su Android il nome di una camera posteriore contiene
  //   spesso anche «camera2 0, facing back», e cercare «front» dentro
  //   «facing front/back» non basta a distinguerle. Le parole del retro sono
  //   più specifiche, quindi vincono se ci sono tutte e due.
  if (PAROLE_RETRO.some((p) => s.includes(p))) return "retro";
  if (PAROLE_FRONTE.some((p) => s.includes(p))) return "fronte";
  return "";
}

/** Si può girare? Con una camera sola, no. */
export function siPuoGirare(camere?: CameraVista[] | null): boolean {
  return (camere ?? []).filter((c) => c && c.id).length >= 2;
}

/** L'identificativo della camera da accendere adesso. Stringa vuota = non c'è
 *  niente da girare (una camera sola, o nessuna).
 *  ⚠️ `attuale` VUOTO vuol dire «quella di serie», che è la prima dell'elenco:
 *   senza questa riga il primo tocco del pulsante non avrebbe girato niente —
 *   avrebbe scelto proprio quella che era già accesa. */
export function prossimaCamera(p: {
  camere?: CameraVista[] | null;
  attuale?: string | null;
}): string {
  const camere = (p.camere ?? []).filter((c) => c && c.id);
  if (camere.length < 2) return "";
  const attuale = String(p.attuale || "").trim();
  const i = Math.max(0, camere.findIndex((c) => c.id === attuale));
  const verso = versoCamera(camere[i]?.nome);
  //  Se si sa da che parte guarda, si salta alla prima che guarda dall'altra.
  if (verso) {
    const opposto: Verso = verso === "fronte" ? "retro" : "fronte";
    //  Si cerca a partire da quella dopo, in giro: con tre camere dietro (i
    //  telefoni di oggi) premendo di nuovo si continua a girare invece di
    //  tornare sempre sulla stessa.
    for (let k = 1; k <= camere.length; k++) {
      const c = camere[(i + k) % camere.length];
      if (versoCamera(c.nome) === opposto) return c.id;
    }
  }
  //  Nomi assenti o tutti dalla stessa parte: la camera dopo, in giro.
  return camere[(i + 1) % camere.length].id;
}
