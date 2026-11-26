/** ── SCHEDA FINTA · LA PAGINA ────────────────────────────────────────────────────────────────────────────────
 *  Fuori da `src/`: non va in produzione, non si compila col progetto (`tsc` guarda solo `src/`). Mette dentro `.crm-theme` quello che la
 *  linguetta «Prodotti» del CRM mette in pagina: l'elenco (con «Aggiungi prodotto», `SchedaNuova` e la finestra «Importa») e la scheda
 *  di un prodotto. Niente accesso: `@/crm/AuthContext` è sostituito da `auth-finto.ts`. Il server è quello vero sopra un database in memoria.
 *  Il prodotto aperto sta nell'indirizzo (`#<id>`), così il collaudo può arrivarci diritto e il tasto indietro funziona. */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/styles.css";
import { useNegozio } from "@/crm/negozio/useNegozio";
import { ElencoProdotti } from "@/crm/ecommerce/prodotti/ElencoProdotti";
import { SchedaProdotto } from "@/crm/ecommerce/prodotti/SchedaProdotto";

const daIndirizzo = () => decodeURIComponent(window.location.hash.slice(1)) || null;

function Pagina() {
  const negozio = useNegozio();
  const [id, setId] = useState<string | null>(daIndirizzo);
  useEffect(() => {
    const alCambio = () => setId(daIndirizzo());
    window.addEventListener("hashchange", alCambio);
    return () => window.removeEventListener("hashchange", alCambio);
  }, []);
  const apri = (nuovo: string | null) => {
    window.location.hash = nuovo ? encodeURIComponent(nuovo) : "";
  };
  return (
    <div className="crm-theme min-h-screen">
      <p className="bg-muted px-4 py-1.5 text-center text-[13px] text-muted-foreground">
        SCHEDA FINTA · dati di PROVA in memoria, nessun database vero: chiudendo il processo si perde tutto
      </p>
      <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
        {id ? <SchedaProdotto id={id} negozio={negozio} apri={apri} /> : <ElencoProdotti negozio={negozio} apri={apri} />}
      </main>
    </div>
  );
}

createRoot(document.getElementById("radice")!).render(<Pagina />);
