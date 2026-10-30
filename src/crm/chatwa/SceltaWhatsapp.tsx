/** ── IL TASTO WHATSAPP VERSO UN LEAD: «WHATSAPP» O «WHATSAPP DEL CRM» ──────────
 *  Richiesta del titolare (30/10/2026). Ogni azione WhatsApp verso un lead
 *  (scheda, Da fare, consulenze del giorno, preventivi…) apre un menu piccolo
 *  con due voci:
 *   · «WhatsApp»: l'app del telefono (wa.me, Business prima su Android), col
 *     messaggio già scritto se c'è;
 *   · «WhatsApp del CRM»: la pagina WhatsApp del CRM sulla chat di quel lead.
 *  Con la finestra di 24 ore CHIUSA (regola delle 23 ore, scelta-whatsapp.ts)
 *  la seconda è spenta e una riga in alto dice perché.
 *
 *  ⚠️ RESTA UN LINK VERO. Il tasto è un'ancora wa.me (tasto destro, «copia
 *   link» e i lettori di schermo la vedono come prima); il tocco normale però
 *   apre il menu. Le voci del menu sono a loro volta ancore: niente
 *   `window.open` in un gestore di clic, che il telefono blocca (vedi
 *   TastoMessaggio).
 *  ⚠️ LA FINESTRA SI LEGGE AL TOCCO, NON PRIMA. Una sola riga di
 *   `whatsapp_contacts` (ultime 9 cifre del numero) quando il menu si apre:
 *   gli elenchi con centinaia di tasti non leggono niente finché nessuno tocca.
 *   Chi ha già il contatto in mano lo passa con `contatto` e non si legge.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { Lock, MessagesSquare } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "../AuthContext";
import { IconaWhatsApp } from "./IconaWhatsApp";
import {
  FRASE_FINESTRA_CHIUSA,
  contattoDelNumero,
  filtroNumero,
  linkNativo,
  sceltaCrm,
  type ContattoPerScelta,
  type SceltaCrm,
} from "./scelta-whatsapp";

type Lettura = { stato: "leggo" } | { stato: "errore" } | SceltaCrm;

/** Il tipo minimo della catena di Supabase che serve qui (la tabella non è nei tipi generati). */
type Catena = {
  select: (c: string) => Catena;
  eq: (c: string, v: string) => Catena;
  like: (c: string, v: string) => Catena;
  limit: (n: number) => Promise<{ data: ContattoPerScelta[] | null; error: unknown }>;
};

/** Una lettura puntuale del contatto di quel numero, all'apertura del menu. */
function useSceltaCrm(
  aperto: boolean,
  telefono: string,
  contatto: ContattoPerScelta | null | undefined,
): Lettura {
  const { user } = useAuth();
  const userId = user?.id;
  const [lettura, setLettura] = useState<Lettura>({ stato: "leggo" });
  //  Valori semplici nelle dipendenze: un `contatto` scritto in linea è un oggetto
  //  nuovo a ogni disegno, e l'effetto girerebbe senza fine.
  const dato = contatto !== undefined;
  const cId = contatto?.id ?? null;
  const cUltima = contatto?.ultimo_in_entrata_il ?? null;

  useEffect(() => {
    if (!aperto) return;
    //  Il contatto c'è già (la pagina l'ha caricato): nessuna lettura.
    if (dato) {
      setLettura(sceltaCrm(cId ? { id: cId, ultimo_in_entrata_il: cUltima } : null, new Date()));
      return;
    }
    const filtro = filtroNumero(telefono);
    if (!userId || !filtro) {
      setLettura(sceltaCrm(null, new Date()));
      return;
    }
    let vivo = true;
    setLettura({ stato: "leggo" });
    void (supabase as unknown as { from: (t: string) => Catena })
      .from("whatsapp_contacts")
      .select("id,phone_e164,ultimo_in_entrata_il")
      .eq("user_id", userId)
      .like("phone_e164", filtro)
      .limit(10)
      .then(
        ({ data, error }) => {
          if (!vivo) return;
          setLettura(
            error
              ? { stato: "errore" }
              : sceltaCrm(contattoDelNumero(data ?? [], telefono), new Date()),
          );
        },
        () => vivo && setLettura({ stato: "errore" }),
      );
    return () => {
      vivo = false;
    };
  }, [aperto, telefono, dato, cId, cUltima, userId]);

  return lettura;
}

type PropsAncora = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target" | "children">;

export function LinkWhatsapp({
  telefono,
  testo,
  contatto,
  onNativo,
  onCrm,
  allinea = "start",
  onClick,
  children,
  ...ancora
}: PropsAncora & {
  telefono: string | null | undefined;
  /** Il messaggio già scritto per l'app del telefono (facoltativo). */
  testo?: string | null;
  /** Il contatto, se la pagina l'ha già: evita la lettura al tocco. */
  contatto?: ContattoPerScelta | null;
  /** Scelto «WhatsApp» (il messaggio parte davvero dall'app). */
  onNativo?: () => void;
  /** Scelto «WhatsApp del CRM». */
  onCrm?: () => void;
  allinea?: "start" | "center" | "end";
  children: ReactNode;
}) {
  const [aperto, setAperto] = useState(false);
  const tel = String(telefono ?? "");
  const nativo = linkNativo(
    tel,
    testo,
    typeof navigator === "undefined" ? "" : navigator.userAgent,
  );
  const crm = useSceltaCrm(aperto, tel, contatto);
  const chiusa = crm.stato === "chiusa";

  const tocco = (e: MouseEvent<HTMLAnchorElement>) => {
    //  Chi usa il tasto può fermare il menu (TastoMessaggio dopo la pressione lunga).
    onClick?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    setAperto(true);
  };

  //  Le voci: 44 px sul telefono, 40 dal computer; il resto come le righe del CRM.
  const voce =
    "flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left outline-none md:min-h-10";

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverAnchor asChild>
        <a
          {...ancora}
          href={nativo || undefined}
          target="_blank"
          rel="noreferrer"
          aria-haspopup="dialog"
          aria-expanded={aperto}
          onClick={tocco}
        >
          {children}
        </a>
      </PopoverAnchor>
      <PopoverContent
        align={allinea}
        sideOffset={6}
        collisionPadding={12}
        aria-label="Scrivi su WhatsApp"
        className="w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border-slate-200 bg-white p-1 text-slate-900 shadow-galleggiante"
        //  Il menu vive in un portale ma i clic risalgono l'albero di React: senza
        //  questo, toccare una voce aprirebbe anche la riga sotto il tasto.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="crm-theme contents">
          {chiusa && (
            <p
              role="note"
              className="t-nota mb-1 flex items-start gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-slate-700"
            >
              <Lock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" />
              {FRASE_FINESTRA_CHIUSA}
            </p>
          )}

          {nativo ? (
            <a
              href={nativo}
              //  wa.me in una scheda nuova (il CRM resta aperto); il link Android si apre e basta.
              target={nativo.startsWith("https:") ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={() => {
                onNativo?.();
                setAperto(false);
              }}
              className={cn(voce, "hover:bg-slate-50 focus-visible:bg-slate-100")}
            >
              <IconaWhatsApp className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="min-w-0">
                <span className="t-riga block font-medium">WhatsApp</span>
                <span className="t-nota block text-slate-500">
                  {testo?.trim() ? "Sull'app, col messaggio già scritto" : "Sull'app del telefono"}
                </span>
              </span>
            </a>
          ) : (
            <div aria-disabled="true" className={cn(voce, "cursor-not-allowed text-slate-400")}>
              <IconaWhatsApp className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="t-riga block font-medium">WhatsApp</span>
                <span className="t-nota block">Numero non valido</span>
              </span>
            </div>
          )}

          {crm.stato === "aperta" ? (
            <Link
              to="/CRM/whatsapp"
              search={{ chat: crm.contattoId }}
              onClick={() => {
                onCrm?.();
                setAperto(false);
              }}
              className={cn(voce, "hover:bg-slate-50 focus-visible:bg-slate-100")}
            >
              <MessagesSquare aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="t-riga block font-medium">WhatsApp del CRM</span>
                <span className="t-nota block text-slate-500">Apre la chat di questo lead</span>
              </span>
            </Link>
          ) : (
            <div
              aria-disabled="true"
              aria-busy={crm.stato === "leggo" || undefined}
              className={cn(voce, "cursor-not-allowed text-slate-400")}
            >
              <MessagesSquare aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="t-riga block font-medium">WhatsApp del CRM</span>
                <span className="t-nota block text-slate-500">
                  {crm.stato === "leggo"
                    ? "Controllo la finestra di 24 ore…"
                    : crm.stato === "errore"
                      ? "Non riesco a leggere la chat: riprova"
                      : "Spenta finché il cliente non riscrive"}
                </span>
              </span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
