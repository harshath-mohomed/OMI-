# Authoritative Multi-Player Sri Lankan OMI Engine

A high-performance, production-grade, authoritative multiplayer card game engine implementing authentic Sri Lankan OMI rules. Built with a strict separation of concerns, the system runs with absolute server authority—preventing client-side manipulation, packet replay modifications, or state desynchronization.

The architecture is optimized for zero-latency local Wi-Fi networks and scalable cloud deployments, utilizing **Node.js (ES Modules)**, **Express**, **Socket.IO (forced WebSocket transport)**, **Redis (in-memory game state)**, and **PostgreSQL (persistent player metrics and historical ledger)**.

---

## 1. System Architecture & Component Mapping

The engine enforces a rigid **Data-Access Repository Pattern** coupled with a **Finite State Machine (FSM)**. The browser serves strictly as a passive rendering pipeline (UI/UX Layer), while all mechanics, validations, deck shuffles, and rulesets live entirely inside the server's domain isolation layers.

```
+-----------------------------------------------------------------------------+
|                             NATIVE NETWORK HARDWARE                         |
|         Clients (Browsers via Local Wi-Fi) <---> Host Machine (Port 3000)   |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼  [Forced WebSocket Connection]
+-----------------------------------------------------------------------------+
|                               SOCKET.IO LAYER                               |
|       [lobby.js]        [gameplay.js]        [chat.js]      [reconnect.js]  |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼
+-----------------------------------------------------------------------------+
|                                 ROOM LAYER                                  |
|         [Room.js] Handles In-Memory Sessions & Match Routing Allocations    |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼
+-----------------------------------------------------------------------------+
|                             AUTHORITATIVE GAME ENGINE                       |
|                             [GameEngine.js] (Router)                        |
|                                      │                                      |
|        ┌─────────────────────────────┼──────────────────────────────┐      |
|        ▼                             ▼                              ▼      |
| [MatchManager.js] (FSM)      [RoundManager.js]              [TrickResolver.js] |
| [ScoreManager.js]            [RuleValidator.js]             [Dealer.js]     |
| [Deck.js / Card.js]          [Player.js]                    [Redis Cache]   |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼ [Asynchronous Connection Pools]
+-----------------------------------------------------------------------------+
|                              DATA PERSISTENCE LAYER                         |
|    ┌─────────────────────────────────┴─────────────────────────────────┐   |
|    ▼                                                                   ▼   |
| [REDIS SERVICE] (Port 6379)                    [POSTGRESQL] (Port 5432)    |
| • Live Hand Memory Caching                     • Persistent User Ledgers   |
| • Active Trick Jolt Buffer                     • Match History Archives    |
| • Room Context State Maps                      • Aggregate Win/Loss Stats  |
+-----------------------------------------------------------------------------+
```

### Server vs. Client Responsibilities

| Authoritative Server Actions (Trusted) | Client Rendering Actions (Untrusted) |
| :--- | :--- |
| Shuffling cards & running the random dealer loop | Rendering card-fly transitions & custom animations |
| Splitting deals into 4-card operational batches | Capturing UI click coordinates for card choices |
| Validating suit-matching constraints | Updating static scores in the DOM layout |
| Evaluating trick winners & scoring points | Emitting system notifications & streaming room chat |

---

## 2. Core Game Phases (Finite State Machine)

The engine drives game transitions through an explicit state machine configuration inside `MatchManager.js`:

```
[ LOBBY ]
   │  (Exactly 4 Players Submit Room Code)
   ▼
[ WAITING_FOR_PLAYERS ]
   │  (Auto-Triggered Bootstrap Init)
   ▼
[ MATCH_START ] ──➔ Allocates Score Manager counters
   │
   ▼
[ FIRST_DEAL ] ──➔ Distributes exactly 4 cards to each player clockwise
   │
   ▼
[ TRUMP_SELECTION ] ──➔ Blurs non-authorized screens; Prompts Dealer/Chooser input
   │
   ▼
[ SECOND_DEAL ] ──➔ Distributes remaining 4 cards; Totaling 8 cards per hand
   │
   ▼
[ PLAYING ] ──➔ Validates turns; Rejects illegal suit-breaks; Resolves tricks
   │
   ├─── [ TRICK_COMPLETE ] ──➔ Resolves winner ──➔ Sets next turn position
   │                                                     │
   ▼                                                     ▼
[ ROUND_END ] ◄───────────────────────────────────────────┘ (When a Team hits 5 Tricks)
   │
   ├───► [ MATCH_END ] (Target Game Score Met ──➔ Writes out persistent stats)
   │
   └───► (Rotate Dealer Counter Clockwise) ──➔ Triggers [ FIRST_DEAL ] loop
```

---

## 3. Database Architecture (PostgreSQL Schema)

The persistent schema guarantees transactional consistency for player logs and historic telemetry queries.

```sql
-- Identity Records Table
CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Historic Match Archive Ledger
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(50) PRIMARY KEY,
    room_code VARCHAR(10) NOT NULL,
    winner_team VARCHAR(2) NOT NULL, -- 'A' or 'B'
    score_a INTEGER NOT NULL,
    score_b INTEGER NOT NULL,
    played_at TIMESTAMPTZ NOT NULL
);

-- Aggregated Lifetime Analytics Profile
CREATE TABLE IF NOT EXISTS player_stats (
    player_id VARCHAR(50) PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0
);
```

---

## 4. Local Network Installation & Deployment

To completely avoid container routing overhead and drop local connection latency to absolute zero, run this stack natively on your host machine.

### Prerequisites

- Node.js (v20+ or v22+ Recommended)
- PostgreSQL Server (Listening on local port 5432)
- Redis Server (Listening on local port 6379)

### 1. Repository Synchronization & Installation

```bash
git clone https://github.com/your-username/omi-multiplayer.git
cd omi-multiplayer
npm install
```

### 2. Native Environment Configuration

Create a file named `.env` in the root of the project directory to map your local connection attributes:

```ini
PORT=3000
NODE_ENV=production

# Native Local PostgreSQL Connection Options
PGHOST=127.0.0.1
PGUSER=postgres
PGPASSWORD=your_actual_postgres_installation_password
PGDATABASE=postgres
PGPORT=5432

# Native Local Redis Endpoint Configuration
REDIS_URL=redis://127.0.0.1:6379
```

### 3. Launching the Engine

With your PostgreSQL and Redis backend services running natively in the background, start the game server process:

```bash
npm start
```

The console will verify the connections and log:

```
[INFO] Authoritative OMI Stack running on native port environment: http://localhost:3000
```

---

## 5. Local Network Multiplayer Routing Guide

To play with multiple players across devices in the same room (Laptops, Mobile Devices, Tablets):

**Find your Local Host IP Address:**

- **Windows (CMD):** Run `ipconfig` → Find IPv4 Address under your active Wi-Fi adapter (e.g., `192.168.1.5`).
- **Linux/macOS:** Run `hostname -I` or `ifconfig`.

**Host Connection Setup:**

1. Open your browser to `http://localhost:3000`.
2. Input your username, leave the room code blank, and click **Enter Room Lobby**.
3. Your randomly generated 4-letter alphanumeric Room Code will appear in the top-left section (e.g., `X8Y4`).

**Other Players Joining:**

1. Ensure all devices are connected to the same Wi-Fi network.
2. Open a browser on their devices and type your host machine's IP address and port into the URL bar: `http://192.168.1.5:3000`.
3. Enter a username, input the generated Room Code (`X8Y4`), and click **Join**.
4. Once the 4th player joins, the server auto-boots the game lobby loop and deals the cards.

---

## 6. Real-Time Network Packet (Socket.IO) Events

| Event Identifier | Direction | Payload Structure | Execution Context Description |
| :--- | :--- | :--- | :--- |
| `joinRoom` | Client ➔ Server | `{ username, roomCode, asSpectator }` | Requests connection slot placement in specified room. |
| `syncState` | Server ➔ Client | Full state dictionary schema object | Emits complete room/match footprint data blocks to clients. |
| `chooseTrump` | Client ➔ Server | `{ suit: "HEARTS" }` | Emitted exclusively by the authorized chooser to lock the trump suit. |
| `playCard` | Client ➔ Server | `{ cardId: "ACE_OF_SPADES" }` | Transmits intent to play a card. Rejects out of turn or if breaks suit. |
| `TRICK_RESOLVED` | Server ➔ Client | `{ winnerSeat, winningTeam, completedTrick }` | Fires when 4 cards are played. Signals clients to clear cards from the table. |
| `ROUND_OVER_SUMMARY` | Server ➔ Client | `{ winningTeam, allocatedPoints, isKaputhi }` | Sent as soon as a team claims 5 tricks to distribute round stats. |