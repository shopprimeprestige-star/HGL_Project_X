#!/bin/bash
# ── PONTE WHATSAPP HGL · INSTALLAZIONE SUL MAC ─────────────────────────────
# Commessa 2026-10-29-ponte-whatsapp-baileys, compito T6 (PIANO §a1, §a2).
# Lo lancia il titolare, da Terminale, dalla cartella del repo:
#
#   ./installa.sh            installa o aggiorna: copia il codice in
#                            ~/Library/Application Support/HGL/ponte-wa/app,
#                            npm ci --ignore-scripts, scrive il plist.
#                            NON avvia il servizio: dice come farlo.
#   ./installa.sh stato      se è caricato, l'ultimo stato, le ultime righe del log
#   ./installa.sh chiave     riscrive indirizzo e chiave in config.env
#                            (la chiave non si vede mentre la incolli)
#   ./installa.sh scollega   ferma il ponte, mette da parte la sessione,
#                            lo riavvia: comparirà un codice nuovo
#
# Node: serve un Node LTS, 22 o 24 (Baileys 7 e package.json "engines").
# Lo cerca in Homebrew (node@24, node@22), in nvm e nel PATH; per sceglierlo
# a mano: PONTE_NODE=/percorso/bin/node ./installa.sh. Non installa niente.
#
# Aggiornare non tocca auth/ (la sessione), fila/ né config.env.
#
# Time Machine: la cartella dati del ponte (sessione di WhatsApp in auth/, catalogo dei media in media/,
# config.env) viene ESCLUSA dai backup con `tmutil addexclusion`. Conseguenza, da conoscere: se il Mac si
# perde o si cancella, il ponte non si ripristina da un backup e va ricollegato con un codice QR nuovo.
# Se l'esclusione non riesce, l'installazione va avanti lo stesso e lo dice.
set -euo pipefail

ETICHETTA="it.hgl.ponte-whatsapp"
[ -n "${HOME:-}" ] || { echo "HOME non è impostata." >&2; exit 1; }
BASE="$HOME/Library/Application Support/HGL/ponte-wa"
APP="$BASE/app"
LOG="$HOME/Library/Logs/hgl-ponte-wa.log"
PLIST="$HOME/Library/LaunchAgents/$ETICHETTA.plist"
QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMINIO="gui/$(id -u)"

errore() {
  printf '%s\n' "$@" >&2
  exit 1
}

spiega_node() {
  errore "Il ponte vuole Node 22 o 24 (le versioni LTS); qui ho trovato: $1." \
    "Le linee dispari, come la 25, Baileys non le supporta e escono di supporto in pochi mesi." \
    "Cosa fare (non installo niente da solo):" \
    "  1. brew install node@24      (si mette accanto al node che usi già, non lo cambia)" \
    "  2. ./installa.sh             (trova da solo /opt/homebrew/opt/node@24)" \
    "Se hai già un Node 22 o 24 altrove: PONTE_NODE=/percorso/bin/node ./installa.sh"
}

# $1 = un node: riesce solo se è la 22 o la 24
lts() {
  local v
  v="$("$1" --version 2>/dev/null)" || return 1
  case "$v" in
    v22.* | v24.*) return 0 ;;
    *) return 1 ;;
  esac
}

trova_node() {
  if [ -n "${PONTE_NODE:-}" ]; then
    [ -x "$PONTE_NODE" ] || errore "PONTE_NODE non è un programma eseguibile: $PONTE_NODE"
    if lts "$PONTE_NODE"; then
      printf '%s' "$PONTE_NODE"
      return 0
    fi
    spiega_node "$("$PONTE_NODE" --version 2>/dev/null || echo 'versione sconosciuta')"
  fi
  local c
  for c in /opt/homebrew/opt/node@24/bin/node /opt/homebrew/opt/node@22/bin/node \
    /usr/local/opt/node@24/bin/node /usr/local/opt/node@22/bin/node \
    "$HOME"/.nvm/versions/node/v24.*/bin/node "$HOME"/.nvm/versions/node/v22.*/bin/node \
    "$(command -v node 2>/dev/null || true)"; do
    if [ -n "$c" ] && [ -x "$c" ] && lts "$c"; then
      printf '%s' "$c"
      return 0
    fi
  done
  spiega_node "$(node --version 2>/dev/null || echo 'nessun node')"
}

# Chiede indirizzo e chiave e scrive config.env (600). La chiave non si
# vede mentre la si incolla e non si stampa mai.
chiedi_chiave() {
  [ -t 0 ] || errore "Per scrivere config.env serve un Terminale: rilancia ./installa.sh chiave."
  local URL TOKEN
  echo "Servono l'indirizzo della rotta del CRM e la chiave PONTE_WA_TOKEN (la stessa dei segreti del Worker)."
  if [ -n "${PONTE_WA_URL:-}" ]; then
    URL="$PONTE_WA_URL"
    echo "Indirizzo: $URL"
  else
    read -r -p "Indirizzo (https://…/api/public/ponte-whatsapp): " URL
  fi
  case "$URL" in
    https://*) ;;
    *) errore "L'indirizzo deve cominciare con https://" ;;
  esac
  case "$URL" in
    *[[:space:]\"\'\\]*) errore "L'indirizzo contiene spazi o virgolette." ;;
  esac
  #  La chiave da un file (permessi 600) invece che incollata: niente appunti,
  #  niente chiave finita per sbaglio nel campo dell'indirizzo.
  if [ -n "${PONTE_WA_CHIAVE_FILE:-}" ]; then
    [ -r "$PONTE_WA_CHIAVE_FILE" ] || errore "Non leggo il file della chiave."
    TOKEN="$(tr -d '[:space:]' < "$PONTE_WA_CHIAVE_FILE")"
    echo "Chiave: letta dal file (non si stampa)."
  else
    read -r -s -p "Chiave (mentre la incolli non si vede nulla; poi Invio): " TOKEN
    echo
  fi
  [ "${#TOKEN}" -ge 32 ] || errore "La chiave è troppo corta: servono almeno 32 caratteri (openssl rand -hex 32)."
  case "$TOKEN" in
    *[!A-Za-z0-9_-]*) errore "La chiave può contenere solo lettere, cifre, - e _." ;;
  esac
  umask 077
  mkdir -p "$BASE"
  local tmp="$BASE/config.env.tmp"
  printf '# Ponte WhatsApp HGL: contiene la chiave, non condividerlo.\n' >"$tmp"
  printf 'PONTE_URL=%s\n' "$URL" >>"$tmp"
  printf 'PONTE_TOKEN=%s\n' "$TOKEN" >>"$tmp"
  if [ -f "$BASE/config.env" ]; then
    grep -v -e '^PONTE_URL=' -e '^PONTE_TOKEN=' -e '^#' "$BASE/config.env" >>"$tmp" || true
  else
    printf 'STORICO_GIORNI=0\nATTESA_PARI_SECONDI=30\n' >>"$tmp"
  fi
  unset TOKEN
  chmod 600 "$tmp"
  mv "$tmp" "$BASE/config.env"
  echo "config.env scritto (permessi 600). La chiave non è stata mostrata."
}

# Time Machine non deve copiare la sessione (auth/) né il catalogo dei media (media/catalogo): si esclude la
# cartella dati intera (con le cartelle future, come auth.scollegato-…). Senza -p: non serve l'amministratore.
# Non è mai un errore: senza tmutil o se fallisce, si dice e si va avanti.
escludi_dai_backup() {
  if ! command -v tmutil >/dev/null 2>&1; then
    echo "Backup: tmutil non c'è su questo Mac, la cartella dati non è stata esclusa da Time Machine." >&2
    return 0
  fi
  if tmutil addexclusion "$BASE" >/dev/null 2>&1; then
    echo "Backup: la cartella dati del ponte è esclusa da Time Machine (un Mac perso richiede un codice QR nuovo)."
  else
    echo "Backup: non sono riuscito a escluderla da Time Machine; puoi farlo a mano: tmutil addexclusion \"$BASE\"" >&2
  fi
  return 0
}

scrivi_plist() {
  local node="$1"
  "$node" -e '
    const fs = require("fs");
    const [modello, uscita, node, app, log] = process.argv.slice(1);
    const x = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const testo = fs.readFileSync(modello, "utf8").replaceAll("{{NODE}}", x(node)).replaceAll("{{APP}}", x(app)).replaceAll("{{LOG}}", x(log));
    fs.writeFileSync(uscita, testo, { mode: 0o600 });
  ' "$QUI/launchd/$ETICHETTA.plist.modello" "$PLIST.tmp" "$node" "$APP" "$LOG"
  plutil -lint "$PLIST.tmp" >/dev/null || errore "Il plist generato non è valido: niente cambiato."
  mv "$PLIST.tmp" "$PLIST"
}

installa() {
  local NODE NPM NUOVA
  NODE="$(trova_node)"
  NPM="$(dirname "$NODE")/npm"
  [ -x "$NPM" ] || errore "Non trovo npm accanto a $NODE."
  echo "Node: $NODE ($("$NODE" --version))"

  umask 077
  mkdir -p "$BASE/auth" "$BASE/fila" "$(dirname "$LOG")" "$(dirname "$PLIST")"
  chmod 700 "$BASE" "$BASE/auth" "$BASE/fila"
  escludi_dai_backup

  NUOVA="$BASE/app.nuova"
  rm -rf "$NUOVA"
  mkdir -p "$NUOVA"
  cp -R "$QUI/src" "$QUI/package.json" "$QUI/package-lock.json" "$NUOVA/"
  echo "Installo le dipendenze esatte del lockfile (npm ci --ignore-scripts)…"
  # npm va lanciato col SUO node: nel PATH prima la cartella del Node LTS
  if ! (cd "$NUOVA" && PATH="$(dirname "$NODE"):$PATH" "$NPM" ci --omit=dev --ignore-scripts --no-audit --no-fund); then
    rm -rf "$NUOVA"
    errore "npm ci non è riuscito: la copia installata prima, se c'era, resta com'era."
  fi
  rm -rf "$APP"
  mv "$NUOVA" "$APP"

  if [ ! -f "$BASE/config.env" ]; then
    chiedi_chiave
  fi
  chmod 600 "$BASE/config.env"
  scrivi_plist "$NODE"

  echo
  echo "Fatto. Codice in: $APP"
  echo "Il servizio NON è stato avviato. Prima prova (non manda niente al CRM; si ferma con Ctrl-C):"
  echo "  cd \"$APP\" && \"$NODE\" src/index.mjs --senza-invio"
  echo "Avvio vero (resta acceso e riparte da solo):"
  echo "  launchctl bootstrap $DOMINIO \"$PLIST\""
  echo "Se era già avviato, per passare alla versione nuova:"
  echo "  launchctl kickstart -k $DOMINIO/$ETICHETTA"
}

stato() {
  if [ ! -f "$PLIST" ] && [ ! -d "$APP" ]; then
    echo "Il ponte non è installato (manca $PLIST)."
    return 0
  fi
  if launchctl print "$DOMINIO/$ETICHETTA" >/dev/null 2>&1; then
    echo "Servizio: caricato in launchd."
  else
    echo "Servizio: non caricato. Per avviarlo: launchctl bootstrap $DOMINIO \"$PLIST\""
  fi
  if [ -f "$BASE/stato.json" ]; then
    echo "Ultimo stato (stato.json):"
    cat "$BASE/stato.json"
  else
    echo "Ancora nessuno stato.json."
  fi
  if [ -f "$BASE/qr.png" ]; then
    echo "C'è un codice da inquadrare: open \"$BASE/qr.png\""
  fi
  if [ -f "$LOG" ]; then
    echo "Ultime righe del log (solo codici e numeri):"
    tail -n 15 "$LOG"
  fi
}

scollega() {
  [ -d "$BASE/auth" ] || errore "Non c'è una sessione da scollegare ($BASE/auth)."
  echo "Ferma il ponte, mette da parte la sessione di WhatsApp e lo riavvia: comparirà un codice nuovo da inquadrare."
  local ok caricato=0 dest
  read -r -p "Scrivi SCOLLEGA per continuare: " ok
  [ "$ok" = "SCOLLEGA" ] || errore "Niente fatto."
  if launchctl print "$DOMINIO/$ETICHETTA" >/dev/null 2>&1; then
    caricato=1
    launchctl bootout "$DOMINIO/$ETICHETTA" || true
  fi
  dest="$BASE/auth.scollegato-$(date +%Y-%m-%dT%H-%M-%S)"
  mv "$BASE/auth" "$dest"
  (umask 077 && mkdir "$BASE/auth")
  rm -f "$BASE/lid.json"
  echo "Sessione messa da parte in: $dest"
  echo "Sul telefono: WhatsApp Business, Dispositivi collegati: NON togliere ancora il vecchio «Mac OS» (serve per tornare indietro); toglilo solo dopo i controlli della guida."
  if [ "$caricato" = 1 ]; then
    launchctl bootstrap "$DOMINIO" "$PLIST"
    echo "Ponte riavviato: tra poco si apre il codice."
  else
    echo "Il ponte non era avviato. Per avviarlo: launchctl bootstrap $DOMINIO \"$PLIST\""
  fi
}

case "${1:-installa}" in
  installa) installa ;;
  stato) stato ;;
  chiave) chiedi_chiave ;;
  scollega) scollega ;;
  *) errore "Uso: ./installa.sh [installa|stato|chiave|scollega]" ;;
esac
