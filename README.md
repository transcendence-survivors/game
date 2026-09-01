# `@transcendence/game-client`

Client 3D **Babylon.js + Vite + Colyseus** pour Transcendence.

## Stack

- **Babylon.js 9** — moteur 3D WebGL.
- **Vite** — dev server + bundler.
- **colyseus.js 0.16** — client temps réel synchronisé.
- **TypeScript strict** (`erasableSyntaxOnly` activé — pas de parameter properties).

## Décor de la forêt

Le client intègre une sélection du [Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) sous forme de modèles `.glb` autoportés : arbres, rochers, buissons et végétation basse. `ForestPlacement` génère les placements à partir de la seed du monde et des coordonnées du chunk ; tous les clients obtiennent donc le même décor sans l’ajouter à l’état réseau. `ForestRenderer` charge les chunks de décor progressivement autour du joueur, les décharge hors zone et désactive les collisions/picking pour conserver le décor purement visuel.

## Principes d'architecture (branche `feat/core-architecture`)

Le client est **purement présentation + input** :
- Il **ne calcule jamais** sa propre position : il envoie des `InputCommand` au serveur et affiche ce que le serveur lui renvoie.
- Tout paramètre (touches, couleurs, FOV, endpoint, taux d'envoi) vit dans `src/data/*.json`. Aucun magic value dans le code.
- Un seul fichier importe le SDK Colyseus (`network/NetworkClient.ts`) : changer de SDK = un seul fichier à toucher.

| Couche | Responsabilité unique | Modules |
|---|---|---|
| **bootstrap** | Charger config, monter la scène, connecter, démarrer la boucle de rendu. | `main.ts`, `core/Engine.ts`, `core/ConfigLoader.ts` |
| **scenes** | Décrire ce qui peuple la scène hors joueurs (sol, lumières, caméra). | `scenes/GameScene.ts` |
| **entities** | Représenter visuellement les objets dynamiques (joueurs). | `entities/PlayerEntity.ts`, `entities/PlayerRegistry.ts` |
| **input** | Capturer les touches, produire un `InputCommand`. | `input/InputManager.ts` |
| **network** | Joindre la room, mirroir state→scène, push input→serveur. | `network/NetworkClient.ts`, `network/RoomHandler.ts` |
| **data** | Tous les paramètres en JSON. | `data/controls.json`, `data/render.json`, `data/network.json` |

## Arborescence

```
src/
├── main.ts                        # Entry — bootstrap (async)
├── global.css                     # Styles minimaux (canvas plein écran)
├── core/
│   ├── Engine.ts                  # Babylon Engine, render loop, resize
│   └── ConfigLoader.ts            # Lit src/data/*.json (import.meta + Vite env)
├── scenes/
│   └── GameScene.ts               # Ground + ArcRotateCamera + HemisphericLight
├── entities/
│   ├── PlayerEntity.ts            # Cube + matériau, setPosition()
│   └── PlayerRegistry.ts          # Map<sessionId, PlayerEntity> (spawn/update/despawn)
├── input/
│   └── InputManager.ts            # WASD + Space → InputCommand (jump edge-triggered)
├── network/
│   ├── NetworkClient.ts           # Wrapper colyseus.js Client (seul à l'importer)
│   └── RoomHandler.ts             # State callbacks + send loop @ sendRateHz
└── data/
    ├── controls.json              # Key bindings (KeyboardEvent.code)
    ├── render.json                # Couleurs, caméra, taille du sol
    └── network.json               # endpoint Colyseus, sendRateHz
```

## Conventions

1. **TSDoc sur tout export public.**
2. **Aucune dépendance circulaire.** Le flux est strict : `network` → `entities` → (scene). `input` est isolé.
3. **Pas de mutation client de la position.** Si tu vois `this.mesh.position.x += …`, c'est un bug — la position vient toujours du serveur.
4. **`erasableSyntaxOnly: true`** dans tsconfig → pas de `constructor(private x: number)`. Déclare le champ explicitement.

## Commandes

```bash
pnpm install             # ou bun install
pnpm dev                 # vite dev server (port 5173 par défaut)
pnpm build               # tsc && vite build
pnpm preview             # serve le build
```

Variables d'environnement (voir `.env.example`) :

| Var | Défaut | Rôle |
|---|---|---|
| `VITE_GAME_SOCKET_URL` | `ws://localhost:4000` | endpoint du serveur Colyseus. Surcharge `network.json`. |
| `PORT` | `5173` | port Vite. |

## Tester en multi sur 2 PC

1. Démarrer le serveur sur le PC A : `cd apps/game/server && bun run dev`.
2. Configurer `VITE_GAME_SOCKET_URL=ws://<IP-de-A>:4000` côté client.
3. Lancer le client sur les 2 PC : `pnpm dev`.
4. Ouvrir `http://localhost:5173` (ou l'IP du serveur Vite) sur les 2 navigateurs.
5. Chaque joueur voit son cube (vert = local, rouge = distant). WASD bouge, Space saute.

## TODO (hors scope du jalon Socket Test)

- Interpolation des positions distantes (sinon mouvement saccadé à 30Hz).
- Prédiction client + reconciliation pour le joueur local.
- HUD (ping, joueurs connectés, FPS).
- Caméra qui suit le joueur local au lieu d'orbiter.
- Lobby / sélection de room.
