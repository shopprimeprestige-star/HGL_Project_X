/** ── I DUE GESTI SUI DOPPIONI: «UNISCI» E «NON È LA STESSA PERSONA» ─────────
 *
 *  Stavano dentro la pagina «Lead importati». Commessa 2026-10-30 (idea 14):
 *  i doppioni si segnalano anche in «Da fare oggi», la pagina che si apre la
 *  mattina, e lì si devono poter unire con lo stesso tasto. Due copie dello
 *  stesso gesto sono il modo in cui un giorno una delle due dimentica un
 *  controllo: per questo il gesto sta qui, una volta sola, e le pagine lo
 *  chiamano. Le regole (che cosa si copia, che cosa mai) restano in
 *  crm/doppioni.
 *
 *  ⚠️ LO DECIDE UNA PERSONA: queste funzioni partono solo da un tasto premuto.
 *   Nessun giro automatico unisce schede.
 *  ⚠️ NON SI CANCELLA NIENTE: si scrive solo con `updateLead`. L'assorbita
 *   resta in archivio, segnata (`unitoIn`) e messa da parte.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback } from "react";
import { toast } from "sonner";
import { useCRM } from "@/crm/CRMContext";
import type { Lead } from "@/crm/types";
import { nomeDi } from "@/crm/importa/nome-lead";
import { patchAssorbita, patchNonDoppione, patchUnione } from "@/crm/doppioni";

/** `chi`: il nome di chi preme, scritto sulla scheda messa da parte. */
export function useUnioneSchede(chi?: string | null) {
  const { updateLead } = useCRM();

  /** ── UNIRE DUE SCHEDE ──────────────────────────────────────────────────
   *  Due scritture, in quest'ordine: prima la principale si prende quello che
   *  le manca, poi l'altra si segna come assorbita.
   *  ⚠️ L'ORDINE NON È INDIFFERENTE. Se si segnasse prima l'assorbita e la
   *   seconda scrittura fallisse, resterebbe una scheda «unita» dentro una che
   *   non ha mai ricevuto i suoi dati — cioè i dati persi davvero. Così, nel
   *   caso peggiore, si resta con due schede e un po' di campi copiati: il
   *   doppione ricompare e si riprova. */
  const unisciSchede = useCallback(
    async (principale: Lead, assorbita: Lead) => {
      const patch = patchUnione(principale, assorbita);
      if (Object.keys(patch).length > 0 && !(await updateLead(principale.id, patch))) {
        toast.error("Non unite", {
          description: `I dati di ${nomeDi(assorbita)} non sono stati copiati: nessuna delle due schede è stata toccata.`,
        });
        return;
      }
      if (!(await updateLead(assorbita.id, patchAssorbita(principale, chi ?? undefined)))) {
        toast.error("Unione a metà", {
          description: `I dati sono stati copiati su ${nomeDi(principale)}, ma la seconda scheda è ancora in archivio come prima: riprova.`,
        });
        return;
      }
      toast.success(`${nomeDi(assorbita)} unita in ${nomeDi(principale)}`, {
        description:
          "Niente è stato cancellato: la seconda scheda resta in archivio, messa da parte, con scritto dov'è andata.",
      });
    },
    [updateLead, chi],
  );

  /** «Non è la stessa persona»: si ricorda su tutte e due, perché la coppia si
   *  può ritrovare da una parte o dall'altra. */
  const segnaDiverse = useCallback(
    async (a: Lead, b: Lead) => {
      const pa = patchNonDoppione(a, b);
      const pb = patchNonDoppione(b, a);
      const ok1 = Object.keys(pa).length === 0 || (await updateLead(a.id, pa));
      const ok2 = Object.keys(pb).length === 0 || (await updateLead(b.id, pb));
      if (!ok1 || !ok2) {
        toast.error("Non segnato", { description: "La coppia tornerà a comparire: riprova." });
        return;
      }
      toast.success("Segnate come due persone diverse", {
        description: "Questa coppia non comparirà più fra i doppioni.",
      });
    },
    [updateLead],
  );

  return { unisciSchede, segnaDiverse };
}
