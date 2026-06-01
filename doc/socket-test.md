# Test WebSocket — branche `feat/core-architecture`

Procédure pour lancer le test minimal Colyseus du jalon **socket-test** :
une flatmap + cubes pilotés par le serveur, branchés par WebSocket.

Toute la doc ici suppose que les trois submodules `apps/game/{client,server,shared-package}`
sont sur la branche `feat/core-architecture`.

---

## 1. Vue d'ensemble

| Composant | Rôle | Runtime | Port |
|---|---|---|---|
| `apps/game/server` | Serveur Colyseus **autoritaire** : reçoit les inputs, calcule la physique, broadcast l'état. | Bun + `@colyseus/bun-websockets` | **4000** |
| `apps/game/client` | Client Babylon : capture WASD/Space, envoie `InputCommand`, affiche les cubes que le serveur lui renvoie. | Vite + colyseus.js | **5173** |
| `apps/game/shared-package` | Contrat réseau (nom de room, enum des messages, types). Linké en `file:../shared-package`. | — | — |

Le client **ne mute jamais** sa propre position. Toute la simulation tourne côté serveur à 30 Hz (`tickRate`), le client envoie ses inputs à 30 Hz (`sendRateHz`).

---

## 2. Prérequis

- **Bun** ≥ 1.0 — `curl -fsSL https://bun.sh/install | bash` (installe à `~/.bun/bin/bun`).
- **pnpm** ≥ 8 dans le `PATH`.
- **Node.js** ≥ 20.19 ou 22.12 (Vite 8 l'exige ; 20.14 fonctionne avec un *warning*).
- Les 3 submodules clonés et sur la bonne branche :

  ```sh
  git submodule update --init --recursive
  git -C apps/game/client         checkout feat/core-architecture
  git -C apps/game/server         checkout feat/core-architecture
  git -C apps/game/shared-package checkout feat/core-architecture
  ```

---

## 3. Lancement rapide (script)

Depuis la racine du repo principal :

```sh
./apps/game/client/scripts/socket-test.sh
```

Ce que le script fait, dans l'ordre :

1. Vérifie la présence de `bun` (par défaut `~/.bun/bin/bun`, override avec `BUN_BIN=…`) et de `pnpm`.
2. Vérifie que les ports **4000** et **5173** sont libres (échoue sinon en indiquant comment kill).
3. Installe les deps manquantes :
   - `bun install` dans `apps/game/server`
   - `pnpm install --ignore-workspace` dans `apps/game/client`
4. Démarre le serveur en background, attend l'apparition de `listening on :4000` dans les logs (timeout 15 s).
5. Démarre Vite en background, attend l'apparition de `ready in` dans les logs.
6. Affiche les URLs et reste au premier plan jusqu'à `Ctrl+C`, qui kill proprement les deux processus.

Logs écrits dans `/tmp/game-server.log` et `/tmp/game-client.log` (override via `LOG_DIR=…`). Pour les suivre en direct dans un autre terminal :

```sh
tail -f /tmp/game-server.log
tail -f /tmp/game-client.log
```

---

## 4. Lancement manuel (étape par étape)

### 4.1 Serveur Colyseus

```sh
cd apps/game/server
bun install                     # première fois uniquement
bun --watch src/index.ts        # alias : bun run dev
```

Sortie attendue :

```
[server] config loaded — tickRate=30Hz, maxPlayers=2
[server] listening on :4000
```

### 4.2 Client Babylon

```sh
cd apps/game/client
pnpm install --ignore-workspace # première fois uniquement
./node_modules/.bin/vite        # ne PAS utiliser `pnpm dev` — voir note ci-dessous
```

> **Pourquoi pas `pnpm dev` ?** Le `pnpm-workspace.yaml` du client contient une clé
> `allowBuilds` mais pas de champ `packages:`. pnpm interprète alors le dossier comme
> un workspace mal formé et refuse `pnpm run` avec `ERR_PNPM_PACKAGES_FIELD_MISSING_OR_EMPTY`.
> Invoquer `vite` directement contourne le problème sans toucher au yaml. Alternative :
> ajouter `packages: ['.']` dans le yaml.

Sortie attendue :

```
VITE v8.0.2  ready in 283 ms
➜ Local:   http://localhost:5173/
```

### 4.3 Test dans le navigateur

- Ouvre `http://localhost:5173` dans **deux** onglets (ou deux PC distincts, voir §6).
- Chaque onglet rejoint automatiquement la room `game` (créée à la demande).
- **Cube vert** = joueur local, **cube rouge** = joueur distant.
- Contrôles : **W/A/S/D** pour bouger, **Space** pour sauter (edge-triggered : un appui = un saut).
- `maxPlayers=2` par défaut : un troisième client sera rejeté par Colyseus.

---

## 5. Paramètres tunables (JSON, pas de recompile)

| Paramètre | Fichier | Défaut |
|---|---|---|
| Endpoint WebSocket | `apps/game/client/src/data/network.json` (override : `VITE_GAME_SOCKET_URL`) | `ws://localhost:4000` |
| Taux d'envoi inputs (client → serveur) | `apps/game/client/src/data/network.json` → `sendRateHz` | 30 |
| Taille du sol, couleurs, caméra | `apps/game/client/src/data/render.json` | — |
| Bindings clavier | `apps/game/client/src/data/controls.json` | WASD + Space |
| Tick serveur | `apps/game/server/src/data/room.json` → `tickRate` | 30 |
| Joueurs max | `apps/game/server/src/data/room.json` → `maxPlayers` | 2 |
| Gravité, force de saut, vitesse | `apps/game/server/src/data/physics.json` | — |
| Port serveur | `apps/game/server/.env` (`PORT=…`) | 4000 |

Les fichiers JSON sont chargés **une seule fois** au démarrage (`ConfigLoader`) et figés en mémoire. Modifier un JSON requiert un redémarrage (le `--watch` de bun s'en charge côté serveur ; Vite recompile à chaud côté client).

---

## 6. Multi-PC (LAN)

1. Démarre le serveur sur le PC A :
   ```sh
   cd apps/game/server && bun run dev
   ```
   Note l'IP locale du PC A (`ip -4 addr` ou équivalent).

2. Sur **chaque** PC client (A inclus si A joue aussi), exporte l'endpoint :
   ```sh
   export VITE_GAME_SOCKET_URL=ws://<IP-PC-A>:4000
   ```

3. Lance Vite avec `--host` pour qu'il écoute sur l'interface LAN :
   ```sh
   cd apps/game/client
   ./node_modules/.bin/vite --host
   ```

4. Sur chaque PC, ouvre `http://<IP-du-PC>:5173`.

> **Pare-feu** : autorise 4000/tcp (Colyseus) et 5173/tcp (Vite). Sur WSL2,
> exposer le port 4000 depuis Windows nécessite `netsh interface portproxy`
> ou un script de port-forwarding.

---

## 7. Troubleshooting

| Symptôme | Cause | Solution |
|---|---|---|
| `command not found: bun` | `~/.bun/bin` absent du `PATH` du shell non-interactif | `export PATH=$HOME/.bun/bin:$PATH` ou `BUN_BIN=$HOME/.bun/bin/bun ./apps/game/client/scripts/socket-test.sh` |
| `ERR_PNPM_PACKAGES_FIELD_MISSING_OR_EMPTY` | `pnpm-workspace.yaml` du client incomplet | invoquer `./node_modules/.bin/vite` directement, ou `pnpm --ignore-workspace dev` |
| `[error] le port 4000 est déjà utilisé` | run précédent encore vivant | `lsof -ti:4000 \| xargs -r kill` (idem 5173) |
| Warning Vite *"Node.js 20.14"* | Node trop ancien pour Vite 8 | upgrader à 20.19+ ou 22.12+ (`nvm install 22 && nvm use 22`) |
| Le client se connecte mais aucun cube ne spawn | mauvais `VITE_GAME_SOCKET_URL`, ou le serveur écoute sur une autre IP | console navigateur → vérifier l'URL effective ; côté serveur, vérifier `listening on :4000` |
| Mouvement saccadé en multi | normal au jalon socket-test (pas d'interpolation) | TODO listée dans le README client |
| `Cannot find package '@transcendence/game-shared'` | `pnpm install` non lancé après checkout / lien `file:` cassé | re-lancer `pnpm install --ignore-workspace` dans `apps/game/client` et `bun install` dans `apps/game/server` |

---

## 8. Arrêter

Le script gère `Ctrl+C` via un `trap` (kill SIGTERM aux deux PID).

Pour kill manuellement :

```sh
pkill -f "bun --watch src/index.ts"
pkill -f "node_modules/.bin/vite"
# ou, plus chirurgical :
lsof -ti:4000,5173 | xargs -r kill
```
