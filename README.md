# 🎮 NEXUS — Discord Roguelite Bot

> **Un seul bot. Une seule mécanique. Rejouabilité infinie.**

NEXUS est un bot Discord roguelite où tu descends des étages générés procéduralement. À chaque étage : un défi unique (combat, énigme, gamble, dilemme). Tu choisis des perks qui se combinent en synergies explosives. Plus tu descends, plus le pacte grimpe — mais si tu meurs, tu perds tout.

***Quit now or risk it all?***

---

## 🚀 Installation

### Prérequis
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Un token de bot Discord (https://discord.com/developers/applications)

### 1. Cloner et installer

```bash
git clone <repo-url>
cd nexus-bot
npm install
```

### 2. Configuration

```bash
cp .env.example .env
# Édite .env avec ton token Discord, DATABASE_URL, etc.
```

### 3. Base de données

```bash
# Démarrer PostgreSQL et Redis (via Docker)
docker compose up -d postgres redis

# Générer le client Prisma et créer les tables
npm run db:generate
npm run db:push
```

### 4. Lancer le bot

```bash
# Mode dev (hot reload)
npm run dev

# Mode production
npm run build
npm start
```

### 5. Docker (tout-en-un)

```bash
docker compose up -d
```

---

## 🎲 Comment jouer

| Commande | Description |
|---|---|
| `/descent [classe]` | Commence une descente roguelite |
| `/next` | Descend à l'étage suivant |
| `/quit` | Quitte avec le pacte actuel |
| `/status` | Affiche ton état (HP, perks, pacte) |
| `/balance` | Affiche tes coins/gems/souls |
| `/daily` | Récompense journalière avec streak |
| `/profile [@user]` | Profil de joueur |
| `/leaderboard [type]` | Classements |

---

## 🏗️ Architecture

```
src/
├── index.ts                  # Entry point — login, events, command registration
├── client.ts                 # NexusClient (extends discord.js Client)
├── config.ts                 # Environment config
├── database.ts               # Prisma client
├── redis.ts                  # Redis client + cooldown/cache helpers
├── logger.ts                 # Pino logger
├── types.ts                  # Shared types
├── handlers/
│   └── commandHandler.ts     # Auto-loads commands from commands/
├── commands/
│   ├── game/                 # Roguelite commands
│   │   ├── descent.ts        # /descent — start a run
│   │   ├── quit.ts           # /quit — secure pact
│   │   └── status.ts         # /status — view run state
│   └── economy/              # Economy commands
│       ├── balance.ts        # /balance
│       ├── daily.ts          # /daily
│       ├── profile.ts        # /profile
│       └── leaderboard.ts    # /leaderboard
├── economy/
│   └── user.ts               # getOrCreateUser, daily rewards
└── roguelite/                # ⭐ THE GAME ENGINE
    ├── rng.ts                # Seeded deterministic PRNG (mulberry32)
    ├── classes.ts            # 4 playable classes
    ├── perks.ts              # 35+ perks with stat modifiers
    ├── synergies.ts          # 12 named synergies (perk combos)
    ├── enemies.ts            # Enemy scaling + bosses
    ├── floors.ts             # Procedural floor generation
    └── engine.ts             # Run manager (start, load, advance, quit, death)
```

---

## 🎯 Mécaniques clés

### Génération procédurale
Chaque run reçoit un **seed** déterministe (mulberry32 PRNG). Le seed détermine les étages, les ennemis, les perks proposés. Deux runs avec le même seed = même expérience.

### Types d'étages
- ⚔️ **Combat** (35%) — combat au tour par tour
- 🎰 **Gamble** (20%) — mini-jeux de casino
- 🧩 **Énigme** (15%) — puzzles logiques
- 🎭 **Dilemme** (15%) — choix narratifs
- 🏪 **Shop** (10%) — achats d'items
- 💀 **Boss** (tous les 5 étages)

### Système de perks et synergies
35+ perks répartis en 6 catégories (offensive, defensive, utility, gamble, curse, relic). Les synergies se déclenchent automatiquement quand certaines combinaisons sont présentes.

### Quit or Continue
Après chaque étage, le joueur choisit :
- 🟢 **Quitter** → sécurise le pacte (fin de run)
- 🔴 **Continuer** → étage suivant, pacte augmente, mais mort = perte totale

---

## 🛠️ Stack technique

| Composant | Choix |
|---|---|
| Framework | discord.js v14 |
| Langage | TypeScript 5 |
| Database | PostgreSQL 16 |
| ORM | Prisma 6 |
| Cache | Redis 7 |
| Logger | Pino |
| Runtime | Node.js 22 |
| Container | Docker + Docker Compose |

---

## 📋 Roadmap

- [x] MVP : moteur roguelite, 4 classes, perks, synergies
- [x] Économie : coins, daily, leaderboard
- [ ] Combat au tour par tour interactif (boutons)
- [ ] Mini-jeux de gamble interactifs
- [ ] Énigmes interactives
- [ ] Système de duel PvP
- [ ] Métaprogression (niveaux, déblocages)
- [ ] Daily Seed
- [ ] Cosmétiques

---

## 📄 Licence

MIT — Libre d'utilisation et de modification.

---

*Voir [GDD.md](./GDD.md) pour le design document complet.*
