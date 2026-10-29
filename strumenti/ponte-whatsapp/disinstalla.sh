#!/bin/bash
# ── PONTE WHATSAPP HGL · DISINSTALLAZIONE ──────────────────────────────────
# Commessa 2026-10-29-ponte-whatsapp-baileys, compito T6.
#
#   ./disinstalla.sh          ferma il ponte, toglie il plist e la copia del
#                             codice (app/). Tiene la sessione (auth/),
#                             config.env, la fila e il log.
#   ./disinstalla.sh --tutto  in più, dopo una conferma scritta, cancella la
#                             cartella di stato (sessione, chiave, fila con i
#                             testi dei clienti, lid.json) e il log.
#
# Non scollega il dispositivo da WhatsApp: lo si toglie dal telefono
# (WhatsApp Business, Dispositivi collegati).
set -euo pipefail

ETICHETTA="it.hgl.ponte-whatsapp"
[ -n "${HOME:-}" ] || { echo "HOME non è impostata." >&2; exit 1; }
BASE="$HOME/Library/Application Support/HGL/ponte-wa"
APP="$BASE/app"
LOG="$HOME/Library/Logs/hgl-ponte-wa.log"
PLIST="$HOME/Library/LaunchAgents/$ETICHETTA.plist"
DOMINIO="gui/$(id -u)"

if launchctl print "$DOMINIO/$ETICHETTA" >/dev/null 2>&1; then
  launchctl bootout "$DOMINIO/$ETICHETTA" || true
  echo "Ponte fermato."
fi
rm -f "$PLIST"
rm -rf "$APP" "$BASE/app.nuova"
echo "Tolti il plist e la copia del codice."

if [ "${1:-}" = "--tutto" ]; then
  echo "Sto per cancellare $BASE (sessione, config.env, fila con i testi dei clienti) e il log."
  read -r -p "Scrivi CANCELLA per confermare: " ok
  if [ "$ok" = "CANCELLA" ]; then
    rm -rf "$BASE"
    rm -f "$LOG" "$LOG.1"
    echo "Cartella di stato e log cancellati."
  else
    echo "Cartella di stato lasciata com'era."
  fi
else
  echo "Restano $BASE (sessione, config.env, fila) e $LOG."
  echo "Per cancellare anche quelli: ./disinstalla.sh --tutto"
fi
echo "Ricorda: sul telefono, WhatsApp Business, Dispositivi collegati: togli «Mac OS» del ponte."
