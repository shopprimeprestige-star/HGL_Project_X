/** Il banco di misura della chat: lo stesso `useChatWa`, lo stesso `ElencoChat` e la stessa `Conversazione`
 *  della pagina vera, con un database finto della dimensione di produzione (strumenti/banco-chat/LEGGIMI). */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import { useChatWa } from "../../src/crm/chatwa/useChatWa";
import { ElencoChat } from "../../src/crm/chatwa/ElencoChat";
import { Conversazione } from "../../src/crm/chatwa/Conversazione";
import { eventi, stats, D, arrivaMessaggio } from "./supabase-finto";
import type { ChatWaApi } from "../../src/crm/chatwa/tipi";

function Pagina() {
  const api = useChatWa({ intercettaChiusura: () => false, apriStatoRapido: () => {} });
  const [aperta, setAperta] = useState(false);
  const apiPagina: ChatWaApi = {
    ...api,
    apri: (k: string) => {
      api.apri(k);
      setAperta(Boolean(k));
    },
  };
  (window as unknown as Record<string, unknown>).__apri = apiPagina.apri;
  return (
    <div style={{ height: "100dvh" }} className="flex bg-background">
      <div className={aperta ? "hidden w-full md:flex md:w-[340px]" : "flex w-full md:w-[340px]"}>
        <ElencoChat api={apiPagina} onCreaScheda={() => {}} />
      </div>
      <div className={aperta ? "block min-w-0 flex-1" : "hidden min-w-0 flex-1 md:block"}>
        <Conversazione api={apiPagina} onIndietro={() => setAperta(false)} onApriLead={() => {}} onCreaScheda={() => {}} onAbbina={() => {}} />
      </div>
    </div>
  );
}

(window as unknown as Record<string, unknown>).__banco = { stats, eventi, D, arrivaMessaggio };
createRoot(document.getElementById("r")!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
