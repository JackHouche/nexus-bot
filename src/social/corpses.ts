/**
 * Dark Souls-style corpse system — when a player dies, their corpse appears
 * at that floor/seed for other players to discover and interact with.
 *
 * Actions on a corpse:
 *  - "loot":    take coins + 1 item
 *  - "respect": pay respects → finder earns gems (and the dead soul finds peace)
 *  - "profane": take everything → big reward but the finder is cursed for the run
 */

import { prisma } from '../database.js';

/** Build snapshot left on the corpse (class, perks, ascendance). */
export interface CorpseBuild {
  class?: string;
  perks?: unknown[];
  ascendance?: string;
  [key: string]: unknown;
}

/** An item entry stored on a corpse's items JSON array. */
export interface CorpseItem {
  itemId: string;
  name: string;
  emoji: string;
  rarity?: string;
  [key: string]: unknown;
}

export type CorpseAction = 'loot' | 'respect' | 'profane';

export interface CorpseInteractionResult {
  action: CorpseAction;
  coinsTaken: bigint;
  itemsTaken: CorpseItem[];
  /** Gems granted to the finder (respect action). */
  gemsEarned: number;
  /** Whether the finder is cursed for the remainder of their run (profane action). */
  cursed: boolean;
  /** The corpse record after interaction. */
  corpse: CorpseRecord;
}

/** Shape returned to the UI layer. */
export interface CorpseRecord {
  id: string;
  userId: string;
  username: string;
  seed: number;
  floor: number;
  buildJson: CorpseBuild;
  coins: bigint;
  items: CorpseItem[];
  found: boolean;
  foundBy: string | null;
  action: CorpseAction | null;
  foundAt: Date | null;
  createdAt: Date;
}

/** Reward tuning constants. */
const RESPECT_GEMS_REWARD = 2;
const PROFANE_COIN_BONUS_MULTIPLIER = 2n;

/**
 * Create a corpse when a player dies in a run.
 *
 * @param userId    Discord user ID of the deceased.
 * @param seed      Run seed (so others on the same seed can find it).
 * @param floor     Floor number where death occurred.
 * @param buildJson Build snapshot — {class, perks, ascendance}.
 * @param coins     Coins the player was carrying (BigInt).
 * @param items     Items the player had (array of item descriptors).
 */
export async function createCorpse(
  userId: string,
  seed: number,
  floor: number,
  buildJson: CorpseBuild,
  coins: bigint,
  items: CorpseItem[]
): Promise<CorpseRecord> {
  const corpse = await prisma.corpse.create({
    data: {
      userId,
      seed,
      floor,
      buildJson: buildJson as never,
      coins: BigInt(coins),
      items: items as never,
    },
    include: { user: true },
  });

  return toCorpseRecord(corpse);
}

/**
 * Find undiscovered corpses at a given floor/seed.
 * A corpse is discoverable while `found` is false.
 *
 * @param seed  Run seed.
 * @param floor Floor number.
 */
export async function findCorpsesAtFloor(
  seed: number,
  floor: number
): Promise<CorpseRecord[]> {
  const corpses = await prisma.corpse.findMany({
    where: { seed, floor, found: false },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  return corpses.map(toCorpseRecord);
}

/**
 * Interact with a corpse discovered at a floor.
 *
 * - "loot":    take coins + exactly 1 item, corpse is marked found.
 * - "respect": grant gems to the finder; corpse is marked found but loot
 *              remains for nobody (the soul is laid to rest).
 * - "profane": take coins (doubled) + ALL items, but the finder is cursed.
 *
 * @param userId   Discord user ID of the finder.
 * @param corpseId Corpse ID.
 * @param action   "loot" | "respect" | "profane".
 */
export async function interactWithCorpse(
  userId: string,
  corpseId: string,
  action: CorpseAction
): Promise<CorpseInteractionResult> {
  const corpse = await prisma.corpse.findUnique({
    where: { id: corpseId },
    include: { user: true },
  });

  if (!corpse) throw new Error('Ce cadavre n\'existe plus...');
  if (corpse.found) throw new Error('Ce cadavre a déjà été découvert.');
  if (corpse.userId === userId) {
    throw new Error('Tu ne peux pas piller ton propre cadavre.');
  }

  const items = (corpse.items as unknown as CorpseItem[]) ?? [];

  let coinsTaken = 0n;
  let itemsTaken: CorpseItem[] = [];
  let gemsEarned = 0;
  let cursed = false;

  const now = new Date();

  if (action === 'loot') {
    // Take coins + exactly 1 item.
    coinsTaken = corpse.coins;
    itemsTaken = items.length > 0 ? [items[0]] : [];
    const remainingItems = items.slice(1);

    await prisma.$transaction([
      // Mark corpse found by this looter.
      prisma.corpse.update({
        where: { id: corpseId },
        data: {
          found: true,
          foundBy: userId,
          action: 'loot',
          foundAt: now,
          items: remainingItems as never,
        },
      }),
      // Grant coins to the finder.
      prisma.user.update({
        where: { id: userId },
        data: { coins: { increment: coinsTaken } },
      }),
      // Audit.
      prisma.transaction.create({
        data: {
          userId,
          type: 'market',
          amount: coinsTaken,
          meta: { source: 'corpse_loot', corpseId, itemsTaken: itemsTaken.map((i) => i.itemId) },
        },
      }),
    ]);
  } else if (action === 'respect') {
    // Pay respects — finder earns gems, no loot taken.
    gemsEarned = RESPECT_GEMS_REWARD;

    await prisma.$transaction([
      prisma.corpse.update({
        where: { id: corpseId },
        data: {
          found: true,
          foundBy: userId,
          action: 'respect',
          foundAt: now,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { gems: { increment: gemsEarned } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'achievement',
          amount: 0n,
          meta: { source: 'corpse_respect', corpseId, gems: gemsEarned },
        },
      }),
    ]);
  } else {
    // Profane — take everything, doubled coins, but cursed.
    coinsTaken = corpse.coins * PROFANE_COIN_BONUS_MULTIPLIER;
    itemsTaken = items;
    cursed = true;

    await prisma.$transaction([
      prisma.corpse.update({
        where: { id: corpseId },
        data: {
          found: true,
          foundBy: userId,
          action: 'profane',
          foundAt: now,
          items: [] as never,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { coins: { increment: coinsTaken } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'market',
          amount: coinsTaken,
          meta: {
            source: 'corpse_profane',
            corpseId,
            cursed: true,
            itemsTaken: itemsTaken.map((i) => i.itemId),
          },
        },
      }),
    ]);
  }

  const updated = await prisma.corpse.findUnique({
    where: { id: corpseId },
    include: { user: true },
  });

  return {
    action,
    coinsTaken,
    itemsTaken,
    gemsEarned,
    cursed,
    corpse: updated ? toCorpseRecord(updated) : toCorpseRecord(corpse),
  };
}

/**
 * Return recent deaths for a graveyard display.
 *
 * NOTE: The Corpse model has no guildId field, so filtering by guild is not
 * possible at the DB level. The `guildId` parameter is accepted for API
 * symmetry with future guild-scoped social features; currently all recent
 * corpses are returned globally.
 *
 * @param guildId Discord guild ID (reserved — unused until schema supports it).
 * @param limit   Maximum number of corpses to return (default 10).
 */
export async function getGraveyard(
  _guildId: string,
  limit: number = 10
): Promise<CorpseRecord[]> {
  const corpses = await prisma.corpse.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  return corpses.map(toCorpseRecord);
}

// ---------------------------------------------------------------------------
//  Internal helpers
// ---------------------------------------------------------------------------

function toCorpseRecord(row: {
  id: string;
  userId: string;
  user: { username: string } | null;
  seed: number;
  floor: number;
  buildJson: unknown;
  coins: bigint;
  items: unknown;
  found: boolean;
  foundBy: string | null;
  action: string | null;
  foundAt: Date | null;
  createdAt: Date;
}): CorpseRecord {
  return {
    id: row.id,
    userId: row.userId,
    username: row.user?.username ?? 'Inconnu',
    seed: row.seed,
    floor: row.floor,
    buildJson: (row.buildJson as CorpseBuild) ?? {},
    coins: row.coins,
    items: (row.items as CorpseItem[]) ?? [],
    found: row.found,
    foundBy: row.foundBy,
    action: (row.action as CorpseAction | null) ?? null,
    foundAt: row.foundAt,
    createdAt: row.createdAt,
  };
}
