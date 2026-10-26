/** ── IL RIQUADRO «PROVA I MODELLI» (Impostazioni → WhatsApp) ────────────────
 *
 *  Richiesta del titolare, 24/10/2026: scegliere un modello, un numero, variabili
 *  finte, e mandare davvero la prova per vedere se arriva. Le regole (numero,
 *  controlli, frasi) sono in `prova-modelli.ts`, provate in
 *  `prove/prova-modelli.mjs`.
 *
 *  ⚠️ LA PROVA PASSA DALLA STESSA STRADA DEL CRM: `/api/whatsapp-send`, che
 *   guarda il canale (cloud o ManyChat) e usa la porta unica. Qui nessuna
 *   scorciatoia: se il modello non ha il flusso, l'esito è quello della porta.
 *  ⚠️ SENZA `leadId`: nessuna scheda viene toccata.
 *  ⚠️ IL NUMERO RESTA NELLO STATO: niente archivio del browser, niente log.
 *  ⚠️ SI VEDE SOLO CON «impostazioni»; la difesa vera sta nella rotta del canale
 *   (guardiaCRM). Gli hook in cima, nessuna uscita anticipata.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fetchCRM, usePuo } from "@/crm/AuthContext";
import { META_TEMPLATES, findMetaTemplate } from "@/crm/wa-meta-templates";
import {
  anteprimaTesto,
  controllaProva,
  corpoProva,
  esitoInChiaro,
  fraseCanale,
  numeroLeggibile,
  valoriDiEsempio,
  type StatoCanale,
} from "@/crm/prova-modelli";

const TONI = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  errore: "border-rose-200 bg-rose-50 text-rose-900",
} as const;

const MODELLO_INIZIALE = META_TEMPLATES[0]?.name ?? "";

export function ProvaModelliWhatsapp() {
  const puo = usePuo()("impostazioni");
  const [modello, setModello] = useState(MODELLO_INIZIALE);
  const [numero, setNumero] = useState("");
  const [valori, setValori] = useState<string[]>(() => {
    const t = findMetaTemplate(MODELLO_INIZIALE);
    return t ? valoriDiEsempio(t) : [];
  });
  const [stato, setStato] = useState<StatoCanale | null>(null);
  const [erroreCanale, setErroreCanale] = useState(false);
  const [daConfermare, setDaConfermare] = useState<{ e164: string; valori: string[] } | null>(null);
  const [errore, setErrore] = useState("");
  const [manda, setManda] = useState(false);
  const [esito, setEsito] = useState<{ tono: "ok" | "errore"; frase: string } | null>(null);

  const t = findMetaTemplate(modello);

  useEffect(() => {
    if (!puo) return;
    let vivo = true;
    fetchCRM("/api/crm/whatsapp-canale")
      .then(async (res) => {
        if (!vivo) return;
        if (!res.ok) return setErroreCanale(true);
        setStato((await res.json()) as StatoCanale);
      })
      .catch(() => vivo && setErroreCanale(true));
    return () => {
      vivo = false;
    };
  }, [puo]);

  const anteprima = useMemo(() => (t ? anteprimaTesto(t, valori) : ""), [t, valori]);

  const scegliModello = (nome: string) => {
    const nuovo = findMetaTemplate(nome);
    if (!nuovo) return;
    setModello(nome);
    setValori(valoriDiEsempio(nuovo));
    setErrore("");
    setEsito(null);
  };

  const chiediConferma = () => {
    setEsito(null);
    const c = controllaProva({ numero, modello, valori, stato });
    if (!c.ok) return setErrore(c.motivo);
    setErrore("");
    setDaConfermare({ e164: c.e164, valori: c.valori });
  };

  const mandaLaProva = async () => {
    if (!t || !daConfermare) return;
    const { e164, valori: v } = daConfermare;
    setDaConfermare(null);
    setManda(true);
    try {
      const res = await fetchCRM("/api/whatsapp-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpoProva(t, e164, v)),
      });
      const corpo: unknown = await res.json().catch(() => null);
      setEsito(esitoInChiaro(res.status, corpo, e164));
    } catch {
      setEsito({
        tono: "errore",
        frase: "Il server non risponde: la prova non è partita, riprova.",
      });
    } finally {
      setManda(false);
    }
  };

  if (!puo) return null;

  const frase = erroreCanale
    ? "Non riesco a leggere il canale WhatsApp: la prova passa comunque dal canale attivo."
    : fraseCanale(stato, modello);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Prova i modelli</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Manda un modello vero a un numero tuo, con variabili finte, per vedere se arriva e come si
          legge. Passa dal canale attivo, come ogni altro messaggio del CRM. Nessuna scheda viene
          toccata.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="prova-modello">Modello</Label>
          <Select value={modello} onValueChange={scegliModello}>
            <SelectTrigger id="prova-modello" className="h-9 text-[13px]">
              <SelectValue placeholder="Scegli un modello" />
            </SelectTrigger>
            <SelectContent>
              {META_TEMPLATES.map((m) => (
                <SelectItem key={m.name} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {frase && (
            <p
              className={cn(
                "text-[12px]",
                stato?.canale === "manychat" && !stato.modelliConFlusso.includes(modello)
                  ? "text-amber-700"
                  : "text-muted-foreground",
              )}
            >
              {frase}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prova-numero">Numero a cui mandarla</Label>
          <Input
            id="prova-numero"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="+39 333 1234567"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="h-9 text-[13px] sm:max-w-xs"
          />
        </div>

        {t && t.params.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {t.params.map((p, i) => (
              <div key={`${t.name}-${p.index}`} className="space-y-1.5">
                <Label htmlFor={`prova-var-${p.index}`}>
                  {p.description}{" "}
                  <span className="text-muted-foreground">({`{{${p.index}}}`})</span>
                </Label>
                <Input
                  id={`prova-var-${p.index}`}
                  value={valori[i] ?? ""}
                  onChange={(e) =>
                    setValori((vecchi) => vecchi.map((v, k) => (k === i ? e.target.value : v)))
                  }
                  className="h-9 text-[13px]"
                />
              </div>
            ))}
          </div>
        )}

        {t && (
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-muted-foreground">Come arriva</p>
            <p className="whitespace-pre-line rounded-md border border-border bg-muted px-3 py-2 text-[13px] leading-snug">
              {anteprima}
            </p>
          </div>
        )}

        {errore && (
          <p role="alert" className="text-[13px] text-destructive">
            {errore}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={chiediConferma} disabled={manda || !t}>
            {manda ? "Invio…" : "Manda la prova"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => t && setValori(valoriDiEsempio(t))}
            disabled={manda || !t}
          >
            Rimetti gli esempi
          </Button>
        </div>

        {esito && (
          <p
            role="status"
            className={cn("rounded-md border px-3 py-2 text-[13px] leading-snug", TONI[esito.tono])}
          >
            {esito.frase}
          </p>
        )}
      </CardContent>

      <AlertDialog
        open={!!daConfermare}
        onOpenChange={(aperto) => !aperto && setDaConfermare(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mandare la prova a {daConfermare ? numeroLeggibile(daConfermare.e164) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Parte un vero messaggio WhatsApp con il modello «{modello}»
              {stato ? ` dal canale ${stato.canale === "manychat" ? "ManyChat" : "Cloud API"}` : ""}
              . Controlla che il numero sia tuo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => void mandaLaProva()}>
              Manda la prova
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
