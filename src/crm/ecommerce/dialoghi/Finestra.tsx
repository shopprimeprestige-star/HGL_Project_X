/** ── LA CORNICE DELLE FINESTRE DI CONFERMA (dialoghi/Finestra.tsx) ──────────────
 *  Rilascio 2, T64. Una finestra vera (`AlertDialog`, non `window.confirm`): il fuoco ci entra, non si chiude cliccando fuori, e finché
 *  un invio è in corso (`inInvio`) non si chiude nemmeno con Esc: una richiesta di rimborso a metà non si lascia dietro a una finestra sparita.
 *  Dentro va il modulo (`FormRimborso`, `FormAnnulla`, `FormSpedisci`), che si disegna e si prova da solo: il portale non si disegna sul server. */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function Finestra({
  titolo,
  descrizione,
  inInvio,
  onChiudi,
  children,
}: {
  titolo: string;
  descrizione: string;
  inInvio: boolean;
  onChiudi: () => void;
  children: ReactNode;
}) {
  return (
    <AlertDialog open onOpenChange={(aperta) => !aperta && !inInvio && onChiudi()}>
      {/*  `crm-theme`: la finestra vive in un portale fuori dal CRM (senza, i colori sono quelli del sito scuro). */}
      <AlertDialogContent className="crm-theme max-h-[90dvh] overflow-y-auto bg-white text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>{titolo}</AlertDialogTitle>
          <AlertDialogDescription>{descrizione}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Il piede comune dei moduli: l'errore (se c'è) e i due tasti. UN solo tasto pieno, quello che fa la cosa; l'altro è «Torna indietro». */
export function PiedeFinestra({
  errore,
  inInvio,
  onChiudi,
  children,
}: {
  errore: string | null;
  inInvio: boolean;
  onChiudi: () => void;
  /** il tasto pieno (type="submit") */
  children: ReactNode;
}) {
  return (
    <>
      {errore && (
        <p role="alert" className="text-[12.5px] text-rose-700">
          {errore}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={inInvio}
          onClick={onChiudi}
          className="min-h-11 text-[13px] sm:min-h-9"
        >
          Torna indietro
        </Button>
        {children}
      </div>
    </>
  );
}
