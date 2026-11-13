/** ── PROVE: `ElencoChatBaileys.tsx`, LA LISTA SEMPLICE (commessa 2026-11-13-chat-baileys, T8) ──
 *  Solo la logica pura di filtro/ordine (`chatBaileys`, esportata dal file insieme al
 *  componente): quali chat entrano (hanno un messaggio del ponte E combaciano con la
 *  ricerca) e in che ordine (dal più recente, come `ordinaComeWhatsapp`). Il disegno
 *  (bersagli, stati vuoti) si controlla a vista con Impeccable, non qui — come già fanno
 *  le altre prove su componenti React (vedi `testi-wame.mjs`, `InstallationScheduleDialog`):
 *  si impacchetta il `.tsx` con esbuild, a parte, e si chiama solo la funzione pura.
 *  Dati inventati: nessun cliente vero. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function proveElencoChatBaileys(_mod, { c, gruppo, radice }) {
  gruppo("ELENCO CHAT BAILEYS: FILTRO (ha un messaggio del ponte + ricerca) E ORDINE");

  const dove = mkdtempSync(join(tmpdir(), "elenco-chat-baileys-"));
  let E;
  try {
    execFileSync(
      "npx",
      [
        "esbuild",
        "src/crm/chatwa/ElencoChatBaileys.tsx",
        "--bundle",
        "--format=cjs",
        `--outfile=${join(dove, "elenco.cjs")}`,
        "--loader:.tsx=tsx",
        "--alias:@=./src",
        "--log-level=error",
      ],
      { cwd: radice, stdio: ["ignore", "ignore", "inherit"] },
    );
    E = createRequire(import.meta.url)(join(dove, "elenco.cjs"));
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }

  /** Una chat finta, con solo i campi che contano per `chatBaileys`. */
  const chat = (phone, { ponte = true, lastIso = null, ultimoIl = null, nome = null } = {}) => ({
    phone,
    leadId: null,
    lead: nome ? { id: phone, data: { nome, cognome: "" } } : null,
    contact: {
      id: phone,
      ha_messaggio_ponte: ponte,
      display_name: null,
      ultimo_messaggio_il: ultimoIl,
    },
    lastMessage: lastIso
      ? { id: `${phone}-m`, direction: "inbound", body: "ciao", created_at: lastIso, status: null }
      : null,
  });

  c(
    "contatto senza messaggio del ponte: fuori",
    [],
    E.chatBaileys([chat("+393331110000", { ponte: false })], ""),
  );
  c(
    "contatto col ponte: dentro",
    ["+393331110000"],
    E.chatBaileys([chat("+393331110000")], "").map((x) => x.phone),
  );
  c(
    "contatto null: fuori (niente da leggere, mai un falso «dentro»)",
    [],
    E.chatBaileys(
      [{ phone: "+39", contact: null, lastMessage: null, lead: null, leadId: null }],
      "",
    ),
  );

  // Ordine: la più recente (lastMessage o ultimo_messaggio_il) prima.
  const vecchia = chat("+391", { lastIso: "2026-11-01T10:00:00.000Z" });
  const recente = chat("+392", { lastIso: "2026-11-12T10:00:00.000Z" });
  const dalContatto = chat("+393", { ultimoIl: "2026-11-13T09:00:00.000Z" }); // più recente delle altre due
  c(
    "ordine: dal messaggio più recente, anche letto solo dal contatto",
    ["+393", "+392", "+391"],
    E.chatBaileys([vecchia, recente, dalContatto], "").map((x) => x.phone),
  );

  // La ricerca (combaciaRicerca): nome, numero.
  const giulia = chat("+393331110000", { nome: "Giulia" });
  const marco = chat("+393339990000", { nome: "Marco" });
  c(
    "ricerca per nome: solo chi combacia",
    ["+393331110000"],
    E.chatBaileys([giulia, marco], "giulia").map((x) => x.phone),
  );
  c("ricerca vuota: tutte (che hanno il ponte)", 2, E.chatBaileys([giulia, marco], "").length);
  c("ricerca che non combacia con nessuno: vuota", [], E.chatBaileys([giulia, marco], "nessuno"));
  //  Una chat senza il ponte non entra nemmeno se il testo della ricerca combacia col nome.
  c(
    "ricerca che combacia ma senza il ponte: resta fuori",
    [],
    E.chatBaileys([chat("+393330000000", { ponte: false, nome: "Giulia" })], "giulia"),
  );
}
