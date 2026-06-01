#!/usr/bin/env bash
# Lance le test minimal Colyseus de la branche feat/core-architecture :
# serveur Bun (port 4000) + client Vite (port 5173) en background, puis attend
# Ctrl+C pour stopper proprement les deux processus.
#
# Variables d'environnement reconnues :
#   BUN_BIN   chemin vers le binaire bun        (def: ~/.bun/bin/bun)
#   LOG_DIR   dossier pour les logs             (def: /tmp)
#
# Voir doc/socket-test.md pour la procédure complète.
set -euo pipefail

# Script résidant dans apps/game/client/scripts/, on remonte de 3 dossiers
# pour atteindre la racine du repo principal qui contient les autres submodules.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SERVER_DIR="$ROOT/apps/game/server"
CLIENT_DIR="$ROOT/apps/game/client"

BUN_BIN="${BUN_BIN:-$HOME/.bun/bin/bun}"
LOG_DIR="${LOG_DIR:-/tmp}"
SERVER_LOG="$LOG_DIR/game-server.log"
CLIENT_LOG="$LOG_DIR/game-client.log"

if [ ! -x "$BUN_BIN" ]; then
  echo "[error] bun introuvable à $BUN_BIN" >&2
  echo "        installe-le (https://bun.sh) ou exporte BUN_BIN=<chemin>" >&2
  exit 1
fi
command -v pnpm >/dev/null || { echo "[error] pnpm requis dans le PATH" >&2; exit 1; }

for port in 4000 5173; do
  if ss -lnt 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$port\$"; then
    echo "[error] le port $port est déjà utilisé — stoppe le précédent run :" >&2
    echo "        lsof -ti:$port | xargs -r kill" >&2
    exit 1
  fi
done

if [ ! -d "$SERVER_DIR/node_modules" ]; then
  echo "[install] $SERVER_DIR"
  (cd "$SERVER_DIR" && "$BUN_BIN" install)
fi
if [ ! -d "$CLIENT_DIR/node_modules" ]; then
  echo "[install] $CLIENT_DIR"
  (cd "$CLIENT_DIR" && pnpm install --ignore-workspace)
fi

SERVER_PID=""
CLIENT_PID=""
cleanup() {
  echo
  echo "[stop] arrêt des processus..."
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$CLIENT_PID" ] && kill "$CLIENT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Vite est invoqué directement (pas via `pnpm dev`) parce que le pnpm-workspace.yaml
# du client ne déclare pas de `packages:`, ce qui fait planter `pnpm run`.

echo "[start] serveur Colyseus -> :4000"
: > "$SERVER_LOG"
( cd "$SERVER_DIR" && exec "$BUN_BIN" --watch src/index.ts ) > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  grep -q "listening on :4000" "$SERVER_LOG" 2>/dev/null && break
  kill -0 "$SERVER_PID" 2>/dev/null || { echo "[error] le serveur s'est arrêté :"; cat "$SERVER_LOG"; exit 1; }
  sleep 0.25
done
if ! grep -q "listening on :4000" "$SERVER_LOG"; then
  echo "[error] timeout : le serveur n'a pas annoncé listening on :4000"
  cat "$SERVER_LOG"
  exit 1
fi
echo "        PID=$SERVER_PID  log=$SERVER_LOG"

echo "[start] client Vite     -> :5173"
: > "$CLIENT_LOG"
( cd "$CLIENT_DIR" && exec ./node_modules/.bin/vite ) > "$CLIENT_LOG" 2>&1 &
CLIENT_PID=$!

for _ in $(seq 1 60); do
  grep -q "ready in" "$CLIENT_LOG" 2>/dev/null && break
  kill -0 "$CLIENT_PID" 2>/dev/null || { echo "[error] le client s'est arrêté :"; cat "$CLIENT_LOG"; exit 1; }
  sleep 0.25
done
echo "        PID=$CLIENT_PID  log=$CLIENT_LOG"

cat <<EOF

Test WebSocket lancé.
  serveur : ws://localhost:4000
  client  : http://localhost:5173

Ouvre http://localhost:5173 dans un (ou deux) navigateurs/onglets.
Logs en direct : tail -f $SERVER_LOG  |  tail -f $CLIENT_LOG
Ctrl+C pour tout arrêter.
EOF

wait
