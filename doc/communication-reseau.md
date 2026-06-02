# Communication réseau — comment les joueurs se « voient »

Ce document explique **comment les clients communiquent via le serveur** dans le
jeu, avec les morceaux de code réels qui réalisent chaque étape.

Les chemins sont donnés depuis la racine `apps/game/` :
`client/…`, `server/…`, `shared-package/…`.

---

## 0. Le principe en une phrase

Le jeu utilise **[Colyseus](https://colyseus.io)** dans un modèle
**serveur-autoritaire** : les clients **ne se parlent jamais directement**.
Chaque client parle uniquement au serveur ; le serveur détient l'unique état
du jeu, le simule, puis **diffuse automatiquement** les changements à tous les
clients. « Voir l'autre joueur bouger » = recevoir une mise à jour d'état du
serveur, pas un message de l'autre client.

```
 JOUEUR A ───input───▶  SERVEUR (autorité)  ───state───▶ JOUEUR A
 JOUEUR B ───input───▶  (simule à 30 Hz)    ───state───▶ JOUEUR B
                                            ───state───▶ …
```

---

## 1. Les deux canaux de communication

Colyseus offre **deux mécanismes distincts**, et le code utilise les deux :

| Canal | Sens | Usage | Comment |
|---|---|---|---|
| **State sync** (schéma) | serveur → tous les clients | positions `x/y/z`, `latencyMs`, `tick` | **automatique** : Colyseus diffe l'état et n'envoie que les deltas |
| **Messages** (hors-bande) | client ↔ serveur (ciblé) | `input`, `ping`/`pong`, `reportLatency` | **explicite** : `room.send(type, payload)` / `onMessage(...)` |

Règle d'or — dans `server/src/schemas/Player.ts`, les champs décorés `@type(...)`
sont **synchronisés** vers les clients ; les autres sont **server-only** et ne
quittent jamais le serveur :

```ts
export class Player extends Schema {
  // -------------------------- Synced (broadcast) --------------------------
  @type('string') id: string = '';
  @type('number') x: number = 0;   // position autoritaire, broadcastée
  @type('number') y: number = 0;
  @type('number') z: number = 0;
  @type('number') latencyMs: number = 0;

  // -------------------------- Server-only state ---------------------------
  vx: number = 0;                  // vitesse : reste sur le serveur
  inputMoveX: number = 0;          // dernier input reçu : reste sur le serveur
  inputJump: boolean = false;
  // …
}
```

> Conséquence : le client reçoit *le résultat* (la position), jamais les
> intermédiaires (vitesse, input brut).

---

## 2. Le contrat partagé (`shared-package`)

Pour qu'aucune chaîne de caractères ne « dérive » entre client et serveur, les
noms de room et de messages vivent dans **un seul fichier** importé des deux
côtés — `shared-package/src/protocol.ts` :

```ts
export const ROOM_NAME = 'game' as const;

export const ClientMessage = {
  Input: 'input',                 // input par tick du joueur local
  Ping: 'ping',                   // sonde de latence
  ReportLatency: 'reportLatency', // RTT mesuré par le client
} as const;

export const ServerMessage = {
  Pong: 'pong',                   // écho du Ping
} as const;
```

Les **payloads** de ces messages sont typés dans
`shared-package/src/types/messages.ts` (ex. `InputCommand { moveX, moveZ, jump }`).

---

## 3. La connexion — rejoindre la room

Côté serveur, la room est enregistrée sous le nom canonique
(`server/src/core/Server.ts`) :

```ts
const transport = new BunWebSockets({});
const server = new Server({ transport });
server.define(ROOM_NAME, GameRoom);   // 'game' → GameRoom
server.listen(port);
```

Côté client, on rejoint **la même** constante `ROOM_NAME`
(`client/src/network/NetworkClient.ts`) :

```ts
async joinGame(): Promise<Room> {
  return this.client.joinOrCreate(ROOM_NAME);  // rejoint, ou crée si besoin
}
```

Le `bootstrap()` du client enchaîne connexion → join, puis câble tout le reste
(`client/src/main.ts`) :

```ts
const network = new NetworkClient(config.network.endpoint); // ws://localhost:4000
const room = await network.joinGame();
console.log(`[client] joined room "${room.name}" as ${room.sessionId}`);
```

Quand un client rejoint, le serveur crée un `Player` et l'insère dans l'état,
**indexé par `sessionId`** (`server/src/rooms/GameRoom.ts`) :

```ts
override onJoin(client: Client): void {
  const player = new Player();
  player.id = client.sessionId;
  // … position de spawn …
  this.state.players.set(client.sessionId, player);
}
```

`players` est une `MapSchema` (`server/src/schemas/GameState.ts`), ce qui donne
aux clients des notifications **add / remove** par entrée :

```ts
export class GameState extends Schema {
  @type('number') tick: number = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
}
```

> Dès qu'un `Player` entre dans `players`, **tous les clients déjà connectés**
> reçoivent un événement `onAdd` (voir §5) et font apparaître son cube. C'est ici
> que « les joueurs se voient » pour la première fois.

---

## 4. Le flux complet : l'action de A arrive chez B

C'est le cœur du sujet. Exemple : le joueur A appuie sur une touche.

```
 JOUEUR A (client)              SERVEUR (GameRoom)              TOUS LES CLIENTS
 ─────────────────             ──────────────────             ──────────────────
 InputManager.snapshot()
        │
 RoomHandler send loop  ──input──▶ onMessage(Input)
   (sendRateHz = 30Hz)             écrit player.inputMoveX/Z/Jump
                                   (champ SERVER-ONLY)
                                          │
                                   tick 30Hz :
                                     MovementSystem → vx/vz
                                     PhysicsSystem  → x/y/z (SYNC)
                                          │
                                   Colyseus diffe l'état ──state──▶ players.onChange
                                                                     registry.update()
                                                                     → le cube bouge
```

### 4.1 — Le client capture l'input

`InputManager.snapshot()` construit un `InputCommand` à partir des touches
tenues (`client/src/input/InputManager.ts`) :

```ts
snapshot(): InputCommand {
  const forward  = this.heldKeys.has(this.controls.moveForward) ? 1 : 0;
  const backward = this.heldKeys.has(this.controls.moveBackward) ? 1 : 0;
  const left     = this.heldKeys.has(this.controls.moveLeft) ? 1 : 0;
  const right    = this.heldKeys.has(this.controls.moveRight) ? 1 : 0;
  const jump = this.jumpQueued;
  this.jumpQueued = false;        // le saut est edge-triggered, consommé une fois
  return { moveX: right - left, moveZ: forward - backward, jump };
}
```

### 4.2 — Le client envoie l'input (à rythme fixe)

`RoomHandler` lance une boucle `setInterval` qui expédie le dernier snapshot à
`sendRateHz` (= 30 Hz, `client/src/data/network.json`).
**Le client n'applique rien localement** — il ne bouge pas son propre cube
(`client/src/network/RoomHandler.ts`) :

```ts
this.sendTimer = setInterval(() => {
  this.room.send(ClientMessage.Input, this.input.snapshot());
}, this.sendIntervalMs);
```

### 4.3 — Le serveur reçoit l'intention

`onMessage(Input)` ne fait que **stocker** l'intention dans des champs
server-only du `Player` (`server/src/rooms/GameRoom.ts`) :

```ts
private handleInput(client: Client, msg: InputCommand): void {
  const player = this.state.players.get(client.sessionId);
  if (player === undefined) return;
  player.inputMoveX = msg.moveX;
  player.inputMoveZ = msg.moveZ;
  // OR logique : ne jamais écraser un saut en attente avec `false`
  if (msg.jump) player.inputJump = true;
}
```

### 4.4 — Le serveur simule (la boucle de tick)

À la création de la room, on installe une boucle de simulation à `tickRate`
(= 30 Hz, `server/src/data/room.json`) :

```ts
const tickMs = 1000 / this.config.room.tickRate;
this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), tickMs);
```

Chaque tick fait tourner le pipeline de systèmes :

```ts
private tick(dt: number): void {
  this.movement.update(this.state, dt);  // input → vitesse (vx/vz)
  this.physics.update(this.state, dt);   // saut/gravité, intègre x/y/z
  this.state.tick = (this.state.tick + 1) % Number.MAX_SAFE_INTEGER;
}
```

- `MovementSystem` transforme l'input en vitesse (et normalise la diagonale)
  — `server/src/systems/MovementSystem.ts`.
- `PhysicsSystem` applique le saut/la gravité et **intègre la position** ; ce
  sont `x/y/z` (champs `@type`) qui changent — `server/src/systems/PhysicsSystem.ts` :

```ts
player.x += player.vx * dt;
player.y += player.vy * dt;
player.z += player.vz * dt;
```

### 4.5 — Diffusion automatique

Dès que `x/y/z` changent, **Colyseus calcule le delta et l'envoie à tous les
clients** : il n'y a *aucun* code d'envoi à écrire pour cela. C'est tout
l'intérêt du state-sync.

### 4.6 — Tous les clients appliquent l'état

Chaque client s'est abonné aux changements via `getStateCallbacks(room)`
(`client/src/network/RoomHandler.ts`) :

```ts
const $ = getStateCallbacks(this.room);

// un joueur apparaît → on crée son cube + on suit ses changements
$(state).players.onAdd((player, sessionId) => {
  this.registry.spawn(sessionId, player.x, player.y, player.z);
  this.panel.add(sessionId, player.latencyMs);

  $(player).onChange(() => {
    this.registry.update(sessionId, player.x, player.y, player.z); // déplace le cube
    this.panel.update(sessionId, player.latencyMs);
  });
});

// un joueur part → on retire son cube
$(state).players.onRemove((_player, sessionId) => {
  this.registry.despawn(sessionId);
  this.panel.remove(sessionId);
});
```

> **Point clé** : même le joueur A voit son propre cube bouger *uniquement*
> quand l'état autoritaire revient du serveur (pas de prédiction côté client
> dans cette version). A et B reçoivent exactement la même chose.
> Donc « A communique avec B » = A → serveur (message `input`) puis
> serveur → {A, B, …} (state sync). **Jamais A → B directement.**

---

## 5. Étude de cas : la latence (les deux canaux ensemble)

Le ping illustre bien la cohabitation **message** + **state** :

1. Le client envoie `ping { t }` toutes les `pingIntervalMs` (= 2000 ms)
   (`client/src/network/LatencyTracker.ts`) :

   ```ts
   private sendPing(): void {
     const t = performance.now();
     this.inFlight.set(t, t);
     this.room.send(ClientMessage.Ping, { t });
   }
   ```

2. Le serveur **renvoie tel quel** `pong { t }` au **seul** client concerné —
   pas besoin d'horloges synchronisées (`server/src/rooms/GameRoom.ts`) :

   ```ts
   private handlePing(client: Client, msg: PingPayload): void {
     client.send(ServerMessage.Pong, { t: msg.t });  // envoi CIBLÉ, pas broadcast
   }
   ```

3. Le client calcule le RTT et le **renvoie** au serveur
   (`client/src/network/LatencyTracker.ts`) :

   ```ts
   private handlePong(msg: PongPayload): void {
     const sentAt = this.inFlight.get(msg.t);
     if (sentAt === undefined) return;
     this.inFlight.delete(msg.t);
     const rtt = performance.now() - sentAt;
     this.room.send(ClientMessage.ReportLatency, { latencyMs: rtt });
   }
   ```

4. Le serveur écrit la valeur dans `player.latencyMs` (**champ synchronisé**),
   en la **clampant** pour qu'un client malveillant ne pollue pas l'affichage
   des autres (`server/src/rooms/GameRoom.ts`) :

   ```ts
   const raw = Number.isFinite(msg.latencyMs) ? msg.latencyMs : 0;
   player.latencyMs = Math.max(0, Math.min(9999, Math.round(raw)));
   ```

5. Comme `latencyMs` est `@type`, **tous** les clients reçoivent le ping de
   chacun via le state-sync normal (le `onChange` du §4.6) → chaque panel
   affiche le ping de tout le monde.

> Ping/pong = canal **message** (ciblé). Affichage chez les pairs = canal
> **state** (broadcast).

---

## 6. Récapitulatif des rôles

| Élément | Rôle |
|---|---|
| **`shared-package`** | Contrat commun (nom de room, noms/payloads de messages, vues d'état). Importé des deux côtés → zéro divergence. |
| **Serveur** | Autorité unique. Reçoit des *intentions* (messages), simule à 30 Hz, mute l'état, laisse Colyseus diffuser. Aucune logique de gameplay dans la room : tout est dans `systems/` + `data/*.json`. |
| **Client** | « Terminal » : capture l'input, l'envoie, et **rend** l'état reçu. Ne décide d'aucune position. |

### Rythmes en jeu

| Paramètre | Valeur | Fichier | Rôle |
|---|---|---|---|
| `tickRate` | 30 Hz | `server/src/data/room.json` | fréquence de simulation serveur |
| `sendRateHz` | 30 Hz | `client/src/data/network.json` | fréquence d'envoi des inputs |
| `pingIntervalMs` | 2000 ms | `client/src/data/network.json` | fréquence des sondes de latence |
| `maxPlayers` | 2 | `server/src/data/room.json` | capacité de la room |

---

## 7. Pour aller plus loin

- **Ajouter un nouveau message** : déclarer son nom dans
  `shared-package/src/protocol.ts`, son payload dans `types/messages.ts`, puis
  `onMessage(...)` côté serveur et `room.send(...)` / `onMessage(...)` côté client.
- **Ajouter un champ d'état synchronisé** : ajouter un `@type(...)` dans le
  schéma serveur (`server/src/schemas/`), refléter le champ dans
  `shared-package/src/types/state.ts`, et le lire dans le `onChange` du
  `RoomHandler`.
- Voir aussi `doc/socket-test.md` (procédure de lancement) et
  `doc/architecture/socket-test-design.md` (design du jalon).
