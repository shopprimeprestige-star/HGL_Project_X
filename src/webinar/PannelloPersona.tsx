/** ── TUTTO QUELLO CHE PUOI FARE A UNA PERSONA ───────────────────────────────
 *
 *  Si apre toccando un nome in chat, ed è il punto in cui si decide cosa fare
 *  di chi ha appena scritto: farlo salire, aprirgli il microfono, spegnergli
 *  la camera, farlo scendere, metterlo alla porta.
 *
 *  ⚠️ SI APRE DA DOVE SI LEGGE. Il gesto nasce leggendo una riga di chat —
 *   «posso chiedere una cosa?» — e in quel momento la persona ce l'hai davanti
 *   agli occhi. Un elenco separato in cui cercarla per nome vuol dire staccare
 *   gli occhi dalla conversazione mentre la sala parla, e con due omonimi vuol
 *   dire sbagliare persona.
 *
 *  ⚠️ E I COMANDI SONO SEPARATI PER GRAVITÀ. Far salire qualcuno e metterlo
 *   alla porta sono due gesti opposti: uno lo si fa dieci volte a sera,
 *   l'altro una volta l'anno e non si torna indietro. Vicini e uguali, prima o
 *   poi si sbaglia bottone davanti a duecento persone.
 */
import { useState } from "react";
import {
  Hand, LogOut, Mic, MicOff, ShieldBan, Video, VideoOff, X, Rows2, Eye, EyeOff } from "lucide-react";
import type { InPalco } from "./tipi";

export interface ComandiPersona {
  faiSalire: (spettatore: string, nome: string, modo: "audio" | "video") => void;
  faiScendere: (spettatore: string) => void;
  microfono: (spettatore: string, acceso: boolean) => void;
  camera: (spettatore: string, accesa: boolean) => void;
  /** mettilo alla pari con te: due quadrati uguali in cima allo schermo di
   *  tutti. Il perché sta su `RegiaPalco.facciaAFaccia`. */
  facciaAFaccia: (spettatore: string, acceso: boolean) => void;
  /** toglilo dalla diretta senza farlo scendere: resta sul palco, col
   *  microfono aperto, ma la sala non lo vede. Vedi `RegiaPalco.mostrati`. */
  inOnda: (spettatore: string, acceso: boolean) => void;
  bandisci: (spettatore: string, nome: string) => void;
}

export function PannelloPersona({
  spettatore, nome, inPalco, comandi, chiudi, inDuello, fuoriCampo,
}: {
  spettatore: string;
  nome: string;
  /** la sua riga sul palco, se c'è: dice se è già in diretta e com'è messo */
  inPalco: InPalco | null;
  /** è già lui quello messo alla pari con chi conduce? */
  inDuello?: boolean;
  /** la regia lo ha tolto dalla diretta? (resta sul palco, ma non si vede) */
  fuoriCampo?: boolean;
  comandi: ComandiPersona;
  chiudi: () => void;
}) {
  const [confermaBando, setConfermaBando] = useState(false);
  const suPalco = !!inPalco && inPalco.stato !== "attesa";
  const conVideo = inPalco?.stato === "video";
  const inFila = inPalco?.stato === "attesa";

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={chiudi}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-[#0b1426] text-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
            {(nome || "?").trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{nome}</p>
            <p className="text-[11px] text-white/45">
              {suPalco ? (conVideo ? "in diretta, con video" : "in diretta, solo voce") : inFila ? "ha alzato la mano" : "sta guardando"}
            </p>
          </div>
          <button onClick={chiudi} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 p-3">
          {/* ── FARLO PARLARE ─────────────────────────────────────────── */}
          {!suPalco ? (
            <>
              {inFila && (
                <p className="flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                  <Hand className="h-3.5 w-3.5" /> Sta aspettando il suo turno
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Comando
                  icona={Mic}
                  testo="Solo voce"
                  nota="Lo sentono, non lo vedono"
                  onClick={() => { comandi.faiSalire(spettatore, nome, "audio"); chiudi(); }}
                />
                <Comando
                  icona={Video}
                  testo="Voce e video"
                  nota="Entra nel salotto"
                  onClick={() => { comandi.faiSalire(spettatore, nome, "video"); chiudi(); }}
                />
              </div>
              {/*  ⚠️ Il permesso glielo chiede il SUO browser nell'istante in
                  cui lo fai salire, non prima: nessuno può aprire camera e
                  microfono di un altro da remoto, e sarebbe grave se si
                  potesse. Dirlo qui evita di aspettarsi una voce che non
                  arriva perché lui non ha ancora premuto «Consenti». */}
              <p className="text-[11px] leading-snug text-white/40">
                Appena lo fai salire, il suo browser gli chiede il permesso per camera e microfono:
                finché non lo dà, non si sente.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Comando
                  icona={inPalco!.microfono ? MicOff : Mic}
                  testo={inPalco!.microfono ? "Chiudi microfono" : "Apri microfono"}
                  acceso={inPalco!.microfono}
                  onClick={() => comandi.microfono(spettatore, !inPalco!.microfono)}
                />
                <Comando
                  icona={conVideo ? VideoOff : Video}
                  testo={conVideo ? "Spegni camera" : "Accendi camera"}
                  acceso={conVideo}
                  onClick={() => comandi.camera(spettatore, !conVideo)}
                />
              </div>
              {/* ── ⚠️ IL FACCIA A FACCIA STA QUI, FRA I COMANDI DEL PALCO ──
                    È un modo di MONTARE, non un permesso: si sceglie mentre si
                    guarda la persona, dopo averle aperto il microfono, ed è
                    quello il momento in cui viene voglia di metterla alla pari.
                    In un menù delle impostazioni non lo troverebbe nessuno nel
                    mezzo di un dibattito.
                   ⚠️ Dice cosa succede, non come si chiama la funzione: «alla
                    pari con te» si capisce senza spiegazioni, «faccia a
                    faccia» è un nome che va imparato. */}
              <Comando
                icona={Rows2}
                testo={inDuello ? "Torna al montaggio normale" : "Mettilo alla pari con te"}
                nota={
                  inDuello
                    ? "Adesso siete due quadrati uguali per tutta la sala"
                    : "Due quadrati uguali in cima: serve per i dibattiti"
                }
                acceso={inDuello}
                onClick={() => comandi.facciaAFaccia(spettatore, !inDuello)}
              />
              {/* ── ⚠️ TOGLIERE DALLA DIRETTA NON È FAR SCENDERE ────────────
                    Sono due cose diverse e stanno vicine apposta, ma non si
                    confondono: «fuori campo» lo toglie dallo schermo della sala
                    e basta — resta sul palco, col microfono aperto, e continua
                    a sentirsi; «fallo scendere» lo rimanda fra il pubblico e
                    gli chiude il microfono.
                   ⚠️ Serve nei dibattiti: mentre parli con uno, gli altri due
                    che hai fatto salire prima restano collegati e pronti, ma
                    non si prendono un pezzo di schermo. Senza, l'unico modo di
                    liberare la scena era farli scendere e poi rifarli salire
                    uno per uno. */}
              <Comando
                icona={fuoriCampo ? Eye : EyeOff}
                testo={fuoriCampo ? "Rimettilo in diretta" : "Toglilo dalla diretta"}
                nota={
                  fuoriCampo
                    ? "Adesso la sala non lo vede: resta collegato e lo senti"
                    : "Resta sul palco e continua a sentirsi, ma non si vede"
                }
                acceso={fuoriCampo}
                onClick={() => comandi.inOnda(spettatore, !!fuoriCampo)}
              />
              <Comando
                icona={LogOut}
                testo="Fallo scendere"
                nota="Torna fra il pubblico, resta in sala"
                onClick={() => { comandi.faiScendere(spettatore); chiudi(); }}
              />
            </>
          )}

          {/* ── ALLA PORTA ────────────────────────────────────────────────
              ⚠️ Staccato dagli altri da una riga, e con una conferma: far
              salire qualcuno lo fai dieci volte a sera, bandirlo una volta
              l'anno e non si torna indietro dal suo punto di vista. Vicini e
              uguali, prima o poi si sbaglia bottone davanti a duecento
              persone. */}
          <div className="border-t border-white/10 pt-2">
            {!confermaBando ? (
              <button
                onClick={() => setConfermaBando(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-rose-300 transition hover:bg-rose-500/10"
              >
                <ShieldBan className="h-4 w-4 shrink-0" />
                <span>Mettilo alla porta</span>
              </button>
            ) : (
              <div className="space-y-1.5 rounded-lg border border-rose-400/40 bg-rose-500/10 p-2.5">
                <p className="text-[11px] leading-snug text-rose-100">
                  Non potrà più entrare, nemmeno con il link. Vale anche per le prossime dirette di
                  questa sala.
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { comandi.bandisci(spettatore, nome); chiudi(); }}
                    className="flex-1 rounded-md bg-rose-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
                  >
                    Mettilo alla porta
                  </button>
                  <button
                    onClick={() => setConfermaBando(false)}
                    className="rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] hover:bg-white/10"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Comando({
  icona: Icona, testo, nota, acceso, onClick,
}: { icona: typeof Mic; testo: string; nota?: string; acceso?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
        acceso ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/15 hover:bg-white/10"
      }`}
    >
      <Icona className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-[12px] font-medium leading-tight">{testo}</span>
        {!!nota && <span className="block text-[10px] leading-tight text-white/45">{nota}</span>}
      </span>
    </button>
  );
}
