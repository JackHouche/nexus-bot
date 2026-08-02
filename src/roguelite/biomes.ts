/**
 * Biome system for NEXUS roguelite.
 *
 * The dungeon is split into 5 biomes of 10 floors each. Each biome has its own
 * enemy pool, color theme, and an *ambient mechanic* — a passive rule that
 * applies while the player is inside the biome (freeze chance, heat damage,
 * perk madness, permanent death).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Ambient mechanics applied each floor while the player is in the biome. */
export type BiomeMechanic =
  | 'none'
  | 'freeze'         // 10% stun chance at combat start (ice_caves)
  | 'heat'           // lose 2 HP per floor (fire_depths)
  | 'madness'        // perks shuffle randomly (cosmic_void)
  | 'permanent_death'; // no soul consolation on death (dead_realm)

export interface Biome {
  id: string;
  name: string;
  emoji: string;
  color: number; // Discord embed color (decimal RGB)
  /** Inclusive [start, end] floor range for this biome. */
  floorRange: { start: number; end: number };
  ambientMechanics: BiomeMechanic;
  /** IDs of enemies that can spawn here (consumed by enemy spawner). */
  enemyPool: string[];
  description: string;
}

/**
 * Mutable player-state slice consumed by `applyBiomeMechanics`.
 * Callers pass their run-state object; ambient effects mutate it in place
 * AND return a log of what changed for the UI.
 */
export interface BiomePlayerState {
  hp: number;
  maxHp: number;
  /** Floors spent in the current biome (reset on biome change). */
  floorsInBiome: number;
  /** Order of perk ids the player currently holds (madness may shuffle). */
  perkOrder: string[];
  /** Set true once the player dies in dead_realm — no soul consolation. */
  permanentDeath?: boolean;
}

export interface BiomeEffectLog {
  biomeId: string;
  mechanic: BiomeMechanic;
  messages: string[];
  /** Whether the player was killed by this tick (e.g. heat on low HP). */
  lethal?: boolean;
}

// ---------------------------------------------------------------------------
// Biomes (5)
// ---------------------------------------------------------------------------

export const BIOMES: Biome[] = [
  {
    id: 'forest',
    name: 'Forêt Ancienne',
    emoji: '🌲',
    color: 0x2ecc71, // green
    floorRange: { start: 1, end: 10 },
    ambientMechanics: 'none',
    enemyPool: ['rat', 'slime', 'wolf', 'spider', 'skeleton'],
    description: 'Une forêt verdoyante et trompeusement calme. Bêtes sauvages et petits slimes y rôdent.',
  },
  {
    id: 'ice_caves',
    name: 'Cavernes de Glace',
    emoji: '❄️',
    color: 0x3498db, // blue
    floorRange: { start: 11, end: 20 },
    ambientMechanics: 'freeze',
    enemyPool: ['golem', 'ghost', 'gargoyle', 'spider', 'skeleton'],
    description: 'Des grottes gelées où le froid s\'infiltre dans les os. 10% de chance d\'être stun au début de chaque combat.',
  },
  {
    id: 'fire_depths',
    name: 'Profondeurs Ardentes',
    emoji: '🔥',
    color: 0xe74c3c, // red
    floorRange: { start: 21, end: 30 },
    ambientMechanics: 'heat',
    enemyPool: ['imp', 'golem', 'wolf', 'zombie'],
    description: 'Des couloirs incandescents. La chaleur accablante inflige 2 dégâts par étage franchi.',
  },
  {
    id: 'cosmic_void',
    name: 'Vide Cosmique',
    emoji: '🌌',
    color: 0x9b59b6, // purple
    floorRange: { start: 31, end: 40 },
    ambientMechanics: 'madness',
    enemyPool: ['ghost', 'imp', 'gargoyle', 'skeleton'],
    description: 'Un néant étoilé où la réalité vacille. Les perks du joueur se réorganisent aléatoirement à chaque combat.',
  },
  {
    id: 'dead_realm',
    name: 'Royaume des Morts',
    emoji: '☠️',
    color: 0x1a1a1a, // black
    floorRange: { start: 41, end: 50 },
    ambientMechanics: 'permanent_death',
    enemyPool: ['zombie', 'ghost', 'skeleton', 'gargoyle', 'golem'],
    description: 'Le domaine final. Ici, la mort est définitive — aucune consolation d\'âme ne vous attend.',
  },
];

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const BIOME_BY_ID: ReadonlyMap<string, Biome> = new Map(
  BIOMES.map((b) => [b.id, b]),
);

/**
 * Return the biome that contains the given floor number.
 * Floors below 1 fall back to the first biome; floors beyond the last
 * biome's range fall back to the final (dead_realm) biome.
 */
export function getBiome(floor: number): Biome {
  const clamped = Math.max(1, Math.floor(floor));
  for (const b of BIOMES) {
    if (clamped >= b.floorRange.start && clamped <= b.floorRange.end) {
      return b;
    }
  }
  // Beyond the last biome → return the deepest one.
  return BIOMES[BIOMES.length - 1]!;
}

export function getBiomeById(id: string): Biome | undefined {
  return BIOME_BY_ID.get(id);
}

// ---------------------------------------------------------------------------
// Ambient mechanics
// ---------------------------------------------------------------------------

/**
 * Apply a biome's ambient mechanic to the player state.
 *
 * `rng` is used only for the probabilistic mechanics (madness shuffling).
 * The function mutates `playerState` in place and returns a log describing
 * what happened, suitable for the Discord UI.
 */
export function applyBiomeMechanics(
  playerState: BiomePlayerState,
  biome: Biome,
  rng?: { pick: <T>(arr: readonly T[]) => T },
): BiomeEffectLog {
  const log: BiomeEffectLog = {
    biomeId: biome.id,
    mechanic: biome.ambientMechanics,
    messages: [],
  };

  playerState.floorsInBiome += 1;

  switch (biome.ambientMechanics) {
    case 'none':
      break;

    case 'freeze': {
      // Freeze is resolved at combat start by the combat loop; here we only
      // surface a reminder so the UI can show the persistent rule.
      log.messages.push('❄️ Le gel ambiant persiste : 10% de stun au début du combat.');
      break;
    }

    case 'heat': {
      const damage = 2;
      playerState.hp = Math.max(0, playerState.hp - damage);
      log.messages.push(`🔥 La chaleur inflige ${damage} dégâts.`);
      if (playerState.hp <= 0) {
        log.lethal = true;
        log.messages.push('💀 La chaleur a eu raison de vous.');
      }
      break;
    }

    case 'madness': {
      if (rng && playerState.perkOrder.length > 1) {
        // Shuffle the perk order deterministically via the provided rng.
        const pool = [...playerState.perkOrder];
        const shuffled: string[] = [];
        while (pool.length > 0) {
          const picked = rng.pick(pool);
          shuffled.push(picked);
          pool.splice(pool.indexOf(picked), 1);
        }
        playerState.perkOrder = shuffled;
        log.messages.push('🌌 Le vide cosmique réorganise vos perks.');
      } else {
        log.messages.push('🌌 Le vide cosmique grésille autour de vos perks.');
      }
      break;
    }

    case 'permanent_death': {
      playerState.permanentDeath = true;
      log.messages.push('☠️ Le royaume des morts scelle votre destin : aucune consolation d\'âme ici.');
      break;
    }
  }

  return log;
}
