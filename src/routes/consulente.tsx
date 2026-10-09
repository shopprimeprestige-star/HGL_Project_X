// ── L'AREA DEL CONSULENTE ───────────────────────────────────────────────────
//  Il CRM completo è dell'amministratore: qui dentro c'è solo quello che serve a
//  chi fa le consulenze, e soprattutto SOLO i suoi lead. Sono tre pagine, non
//  una di più: la giornata (chi devo sentire adesso), i suoi lead (ritrovarne
//  uno fuori dall'agenda) e i suoi numeri (come sta andando).
//
//  L'accesso è a PIN e non con l'utenza dell'amministratore: un consulente non
//  deve poter entrare nel CRM, e un CRM che si apre con la password del titolare
//  finisce per essere aperto da tutti.
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useConsulente, entra, esci } from "@/crm/consulente-sessione";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { BarChart3, CalendarDays, KeyRound, LogOut, Users } from "lucide-react";

export const Route = createFileRoute("/consulente")({
  head: () => ({
    meta: [
      { title: "Area consulente · Hair Genius Labs" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AreaConsulente,
});

function AreaConsulente() {
  const percorso = useRouterState({ select: (s) => s.location.pathname });
  const io = useConsulente();
  //  La sessione vive nel browser: durante la resa lato server non esiste, e
  //  senza questa attesa chi è già collegato vedrebbe comparire per un istante
  //  la richiesta del PIN a ogni ricarica della pagina.
  const [montato, setMontato] = useState(false);
  useEffect(() => setMontato(true), []);

  //  La candidatura è pubblica: chi non è ancora consulente non può trovarsi
  //  davanti la richiesta di un PIN che non ha.
  if (percorso.startsWith("/consulente/registrati")) return <Outlet />;

  return (
    <div className="crm-theme min-h-screen bg-background">
      {!montato ? (
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Caricamento…
        </div>
      ) : !io ? (
        <Accesso />
      ) : (
        <>
          <BarraAlta nome={io.nome} percorso={percorso} />
          <main className="mx-auto max-w-4xl px-3 pb-16 pt-4 md:px-5">
            <Outlet />
          </main>
        </>
      )}
      <Toaster />
    </div>
  );
}

// ── LA BARRA ────────────────────────────────────────────────────────────────
//  Tre voci e l'uscita. Resta attaccata in alto perché su telefono, scorrendo
//  un elenco di trenta appuntamenti, cambiare pagina non deve costare un
//  ritorno in cima.
function BarraAlta({ nome, percorso }: { nome: string; percorso: string }) {
  const iniziale = nome.trim().charAt(0).toUpperCase() || "C";
  const voce = (attiva: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
      attiva
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-3 pt-2 md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
            {iniziale}
          </span>
          <span className="truncate text-[13px] font-medium text-foreground">
            {nome || "Consulente"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => esci()}
          className="shrink-0 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Esci</span>
        </Button>
      </div>
      <nav className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-3 py-2 md:px-5">
        <Link
          to="/consulente"
          className={voce(percorso === "/consulente" || percorso === "/consulente/")}
        >
          <CalendarDays className="h-4 w-4" />
          La giornata
        </Link>
        <Link to="/consulente/leads" className={voce(percorso.startsWith("/consulente/leads"))}>
          <Users className="h-4 w-4" />I miei lead
        </Link>
        <Link to="/consulente/kpi" className={voce(percorso.startsWith("/consulente/kpi"))}>
          <BarChart3 className="h-4 w-4" />I miei numeri
        </Link>
      </nav>
    </header>
  );
}

// ── L'ACCESSO ───────────────────────────────────────────────────────────────
//  Un solo campo per dire chi sei, perché la rotta di accesso confronta quel
//  valore sia col nome sia con l'email: chiedere due campi separati costringe a
//  ricordare con quale dei due si è stati registrati.
function Accesso() {
  const [chi, setChi] = useState("");
  const [pin, setPin] = useState("");
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState("");

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attesa || !pin.trim()) return;
    setAttesa(true);
    setErrore("");
    const esito = await entra(chi.trim(), pin.trim());
    //  A esito positivo questo modulo sparisce da solo: la sessione cambia e
    //  l'area si ridisegna. Serve solo raccontare il rifiuto.
    if (!esito.ok) {
      setErrore(esito.motivo);
      setPin("");
    }
    setAttesa(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Area consulente
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Inserisci il tuo nome (oppure la tua email) e il PIN che ti è stato assegnato.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={invia} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cons-chi">Nome o email</Label>
              <Input
                id="cons-chi"
                value={chi}
                onChange={(ev) => setChi(ev.target.value)}
                autoComplete="username"
                maxLength={120}
                placeholder="Come sei registrato"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cons-pin">PIN</Label>
              <Input
                id="cons-pin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(ev) => setPin(ev.target.value)}
                autoComplete="one-time-code"
                maxLength={12}
                placeholder="••••"
              />
            </div>
            {errore && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {errore}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={attesa || !pin.trim()}>
              {attesa ? "Verifica in corso…" : "Entra"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Non hai ancora un accesso?{" "}
              <Link to="/consulente/registrati" className="underline">
                Candidati come consulente
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
