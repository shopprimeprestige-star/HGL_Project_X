/** ── /chat: SOLO LA CHAT WHATSAPP, A SCHERMO INTERO ──────────────────────────
 *  Richiesta del titolare (28/10/2026): un link che apre SOLO la chat WhatsApp
 *  del CRM, senza barra laterale, testata e menu. Sul telefono come l'app
 *  WhatsApp (elenco → conversazione a tutto schermo, ← per tornare); sul
 *  computer le due colonne a tutta altezza, col pannello Lead nascondibile.
 *
 *  ⚠️ È LA STESSA PAGINA di /CRM/whatsapp (`PaginaChat` con `percorso="/chat"`),
 *   non una copia: una seconda chat si scosterebbe dalla prima al primo ritocco.
 *  ⚠️ STESSA PORTA DEL CRM: stessi provider (AuthProvider, CRMProvider,
 *   UserSettingsProvider), stessa schermata d'accesso e stesso permesso della
 *   voce WhatsApp del menu (`permessoDiPagina("/CRM/whatsapp")`). Dopo l'accesso
 *   si resta qui: la schermata d'accesso si smonta appena c'è l'utente, e al suo
 *   posto si disegna la chat.
 *  ⚠️ NON CARICA IL RESTO DEL CRM: niente barra, ricerca ⌘K, avvisi e passate in
 *   sottofondo. Sono cose del guscio (routes/CRM.tsx), non della chat.
 *  ⚠️ FUORI DAI MOTORI DI RICERCA: `noindex`, e non è in PAGINE_PUBBLICHE (quindi
 *   neanche nella sitemap). È un posto di lavoro, non una pagina del sito. */
import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/crm/AuthContext";
import { CRMProvider } from "@/crm/CRMContext";
import { UserSettingsProvider } from "@/crm/UserSettingsContext";
import { AdminLogin } from "@/crm/AdminLogin";
import { GuardiaPagina } from "@/crm/CRMSidebar";
import { permessoDiPagina } from "@/crm/permessi";
import { reteDeiClic } from "@/crm/clic-liberi";
import { AvvisoVersione } from "@/crm/AvvisoVersione";
import { Toaster } from "@/components/ui/sonner";
import { PaginaChat } from "@/crm/chatwa/PaginaChat";
import { leggiRicercaChat } from "@/crm/chatwa/stato";

//  Lo stesso permesso della pagina dentro il CRM: «stessi permessi» vuol dire
//  leggerlo da lì, non riscriverlo qui.
const PERMESSO = permessoDiPagina("/CRM/whatsapp") ?? undefined;

export const Route = createFileRoute("/chat")({
  //  `?chat=<id del contatto>`: solo un uuid, mai il numero (D21), come /CRM/whatsapp.
  validateSearch: (raw) => leggiRicercaChat(raw),
  head: () => ({
    meta: [
      { title: "WhatsApp · HGL" },
      { name: "robots", content: "noindex, nofollow" },
      //  Salvata sulla Home del telefono si apre senza le barre del browser.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "WhatsApp HGL" },
    ],
  }),
  component: SoloChat,
});

function SoloChat() {
  //  La stessa rete del guscio del CRM: una finestra chiusa a schermo fermo non
  //  deve lasciare la pagina senza clic (vedi crm/clic-liberi.ts).
  useEffect(() => reteDeiClic(), []);
  return (
    <div className="crm-theme h-[100dvh] overflow-hidden">
      <AuthProvider>
        <Porta />
        <Toaster />
      </AuthProvider>
      {/*  Come nel guscio del CRM: la scheda aperta da ieri si accorge della versione nuova. */}
      <AvvisoVersione />
    </div>
  );
}

function Porta() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Caricamento…</div>
      </div>
    );
  }
  //  L'accesso del CRM, a scorrimento: sul telefono il tastierino è più alto
  //  dello schermo, e qui il contenitore non scorre.
  if (!user)
    return (
      <div className="h-full overflow-y-auto">
        <AdminLogin />
      </div>
    );
  return (
    <CRMProvider>
      <UserSettingsProvider>
        <GuardiaPagina permesso={PERMESSO}>
          <PaginaChat percorso="/chat" />
        </GuardiaPagina>
      </UserSettingsProvider>
    </CRMProvider>
  );
}
