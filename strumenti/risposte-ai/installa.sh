#!/bin/bash
# ── Il servizio delle risposte AI sul Mac ────────────────────────────────────
#  ./installa.sh          installa o aggiorna e (ri)avvia il servizio
#  ./installa.sh stato    dice se gira e mostra le ultime righe del log
#  ./installa.sh ferma    lo ferma (riparte al prossimo accesso al Mac)
#  ./installa.sh togli    lo toglie del tutto
#  Usa la chiave del ponte WhatsApp: il ponte deve essere già installato.
set -euo pipefail
ETICHETTA="it.hgl.risposte-ai"
DOVE="$HOME/Library/Application Support/HGL/risposte-ai"
PLIST="$HOME/Library/LaunchAgents/$ETICHETTA.plist"
LOG="$HOME/Library/Logs/hgl-risposte-ai.log"
QUI="$(cd "$(dirname "$0")" && pwd)"
DOMINIO="gui/$(id -u)"

case "${1:-installa}" in
  stato)
    launchctl print "$DOMINIO/$ETICHETTA" 2>/dev/null | grep -E "state =|pid =" || echo "non avviato"
    tail -5 "$LOG" 2>/dev/null || true
    exit 0 ;;
  ferma)
    launchctl bootout "$DOMINIO/$ETICHETTA" 2>/dev/null || true
    echo "fermato"; exit 0 ;;
  togli)
    launchctl bootout "$DOMINIO/$ETICHETTA" 2>/dev/null || true
    rm -f "$PLIST"; rm -rf "$DOVE"
    echo "tolto"; exit 0 ;;
  installa) ;;
  *) echo "comando sconosciuto"; exit 1 ;;
esac

[ -f "$HOME/Library/Application Support/HGL/ponte-wa/config.env" ] || {
  echo "Manca il ponte WhatsApp (config.env): installa prima quello."; exit 1; }
NODE=""
for n in /opt/homebrew/opt/node@24/bin/node /opt/homebrew/opt/node@22/bin/node /opt/homebrew/bin/node; do
  [ -x "$n" ] && "$n" -e 'process.exit(0)' 2>/dev/null && { NODE="$n"; break; }
done
[ -n "$NODE" ] || { echo "Non trovo un Node che funziona."; exit 1; }
CLAUDE="$(command -v claude || true)"
[ -n "$CLAUDE" ] || { echo "Non trovo il comando claude."; exit 1; }

umask 077
mkdir -p "$DOVE/app/src"
cp "$QUI/src/"*.mjs "$DOVE/app/src/"
cp "$QUI/fonti.txt" "$DOVE/app/fonti.txt"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETICHETTA</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>src/index.mjs</string></array>
  <key>WorkingDirectory</key><string>$DOVE/app</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>CLAUDE_BIN</key><string>$CLAUDE</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PL

launchctl bootout "$DOMINIO/$ETICHETTA" 2>/dev/null || true
launchctl bootstrap "$DOMINIO" "$PLIST"
echo "Servizio delle risposte AI avviato. Log: $LOG"
