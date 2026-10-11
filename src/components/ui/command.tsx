"use client";

import * as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/** ─────────────────────────────────────────────────────────────────────────
 *  VARIANTI AGGIUNTE PER LA RICERCA ⌘K
 *
 *  Il file resta quello di partenza e la variante `default` di ogni pezzo è
 *  intatta, riga per riga: chi monta un <CommandItem/> senza chiedere niente
 *  vede esattamente quello che vedeva prima.
 *
 *  Le varianti nuove nascono da un problema preciso. La riga sotto al cursore
 *  si dipingeva con `data-[selected=true]:bg-accent`, cioè con un token di
 *  tema; ma la finestra ⌘K vive in un portale attaccato a <body>, fuori dal
 *  guscio del CRM, e lì `--accent` tornava il blu pieno del marchio: testo
 *  bianco su blu saturo, la riga più importante della finestra diventava
 *  quella meno leggibile. Nella variante `riga` il colore è scritto per
 *  esteso (slate per il fondo, sky per l'indicatore) e nessun tema, dentro o
 *  fuori dal guscio, può più ribaltarlo.
 *  ───────────────────────────────────────────────────────────────────────── */

const CLASSI_ITEM = {
  default:
    "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  riga: cn(
    "group/riga relative flex w-full cursor-pointer select-none items-center gap-3 rounded-lg py-2 pl-3 pr-2.5",
    "text-[13px] text-slate-700 outline-none transition-colors",
    //  La riga scelta si SOLLEVA, non si colora: bianca con un filo di bordo e
    //  un'ombra corta sopra il fondo grigio della finestra. Il testo resta nero
    //  e si legge anche di sbieco, che è come si guarda una lista che scorre.
    //  Una campitura piena farebbe il contrario — la riga più importante
    //  diventerebbe l'unica che si fatica a leggere.
    "data-[selected=true]:bg-white data-[selected=true]:text-slate-900",
    "data-[selected=true]:shadow-sm data-[selected=true]:ring-1 data-[selected=true]:ring-slate-200/80",
    //  L'indicatore a sinistra c'è sempre ed è trasparente finché non tocca a
    //  lui: se comparisse dal nulla sposterebbe il testo a ogni freccia
    //  premuta, e una lista che balla è una lista che non si riesce a leggere.
    "before:pointer-events-none before:absolute before:left-1 before:top-1/2 before:h-5 before:w-[3px]",
    "before:-translate-y-1/2 before:rounded-full before:bg-transparent before:transition-colors",
    "data-[selected=true]:before:bg-sky-500",
    "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
    //  Nessuna misura imposta alle icone: qui dentro convivono icone da 12px
    //  (il telefono nella riga di dettaglio) e da 16px (il tipo di risultato).
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ),
};

const CLASSI_GROUP = {
  default:
    "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
  //  Intestazione discreta: serve a dire "da qui in giù cambia il tipo di
  //  cosa", non a farsi leggere. Piccola, maiuscoletto spaziato, grigia.
  discreta:
    "overflow-hidden px-2 pb-1.5 pt-2.5 [&_[cmdk-group-heading]]:px-1.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-slate-400",
};

const CLASSI_INPUT_CONTENITORE = {
  default: "flex items-center border-b px-3",
  grande: "flex items-center gap-2.5 border-b border-slate-200 px-3.5 sm:px-4",
};

const CLASSI_INPUT_ICONA = {
  default: "mr-2 h-4 w-4 shrink-0 opacity-50",
  grande: "h-[18px] w-[18px] shrink-0 text-slate-400",
};

const CLASSI_INPUT = {
  default:
    "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  //  Campo alto: si scrive qui col telefono in mano e col cliente in linea,
  //  e un input da 40px con testo da 14px si sbaglia a centrare col pollice.
  grande:
    "flex h-14 w-full bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
};

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
    variant?: keyof typeof CLASSI_INPUT;
    /** pezzo facoltativo in fondo al campo: il tasto scorciatoia a campo
     *  vuoto, la crocetta per cancellare appena si scrive qualcosa */
    azione?: React.ReactNode;
  }
>(({ className, variant = "default", azione, ...props }, ref) => (
  <div className={CLASSI_INPUT_CONTENITORE[variant]} cmdk-input-wrapper="">
    <Search className={CLASSI_INPUT_ICONA[variant]} />
    <CommandPrimitive.Input ref={ref} className={cn(CLASSI_INPUT[variant], className)} {...props} />
    {azione}
  </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group> & {
    variant?: keyof typeof CLASSI_GROUP;
  }
>(({ className, variant = "default", ...props }, ref) => (
  <CommandPrimitive.Group ref={ref} className={cn(CLASSI_GROUP[variant], className)} {...props} />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> & {
    variant?: keyof typeof CLASSI_ITEM;
  }
  //  `variant` viene tolto dalle props prima di passare oltre: cmdk gira tutto
  //  quello che non conosce sull'elemento vero, e React scriverebbe un
  //  attributo `variant` sul <div>.
>(({ className, variant = "default", ...props }, ref) => (
  <CommandPrimitive.Item ref={ref} className={cn(CLASSI_ITEM[variant], className)} {...props} />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
