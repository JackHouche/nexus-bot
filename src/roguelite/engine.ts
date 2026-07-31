/**
 * Run Manager — handles creation, state, and resolution of roguelite runs.
 */

import { prisma } from '../database.js';
import { logger } from '../logger.js';
import { RNG, generateSeed } from './rng.js';
import { getClass, type ClassId } from './classes.js';
import { getPerk, getAllPerkIds, computeStats, type Perk } from './perks.js';
import { generateFloor, calculatePact, type FloorEvent } from './floors.js';
import { detectSynergies, previewSynergies } from './synergies.js';

export interface RunState {
  runId: string;
  seed: number;
  className: string;
  currentFloor: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  energy: number;
  maxEnergy: number;
  perks: Perk[];
  activePerkIds: string[];
  synergies: { id: string; name: string; emoji: string }[];
  pactAmount: bigint;
  coinsInRun: number;
  status: 'ACTIVE' | 'COMPLETED_QUIT' | 'COMPLETED_DEAD' | 'ABANDONED';
  currentFloorEvent: FloorEvent | null;
  rng: RNG; // not persisted — reconstructed from seed + floor
}

/**
 * Start a new run for a user.
 */
export async function startRun(
  userId: string,
  className: ClassId
): Promise<RunState> {
  // Check if user already has an active run
  const existing = await prisma.run.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
  if (existing) {
    throw new Error('Tu as déjà une descente en cours. Tape `/status` pour la voir.');
  }

  const classDef = getClass(className);
  const seed = generateSeed();
  const rng = new RNG(seed);

  // Generate first floor
  const floorEvent = generateFloor(rng, 1);

  const run = await prisma.run.create({
    data: {
      userId,
      seed,
      className,
      currentFloor: 1,
      hp: classDef.hp,
      maxHp: classDef.hp,
      atk: classDef.atk,
      def: classDef.def,
      energy: classDef.maxEnergy,
      maxEnergy: classDef.maxEnergy,
      perks: [],
      synergies: [],
      pactAmount: calculatePact(1, rng),
      coinsInRun: 0,
      status: 'ACTIVE',
      floorHistory: JSON.stringify([{ floor: 1, type: floorEvent.type }]),
    },
  });

  logger.info({ userId, runId: run.id, seed, className }, 'Run started');

  return {
    runId: run.id,
    seed,
    className,
    currentFloor: 1,
    hp: run.hp,
    maxHp: run.maxHp,
    atk: run.atk,
    def: run.def,
    energy: run.energy,
    maxEnergy: run.maxEnergy,
    perks: [],
    activePerkIds: [],
    synergies: [],
    pactAmount: run.pactAmount,
    coinsInRun: 0,
    status: 'ACTIVE',
    currentFloorEvent: floorEvent,
    rng,
  };
}

/**
 * Reconstruct a RunState from the database.
 * The RNG is re-seeded and fast-forwarded to the current floor.
 */
export async function loadRun(userId: string): Promise<RunState | null> {
  const run = await prisma.run.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
  if (!run) return null;

  // Reconstruct RNG and fast-forward to current floor
  const rng = new RNG(run.seed);
  let floorEvent: FloorEvent | null = null;

  // We need to replay the generation to get the current floor event.
  // Since floors are deterministic from seed, we replay up to currentFloor.
  for (let f = 1; f <= run.currentFloor; f++) {
    floorEvent = generateFloor(rng, f);
  }

  const perks = (run.perks as unknown as Perk[]).map(
    (p) => getPerk(p.id) || p
  );
  const activePerkIds = perks.map((p) => p.id);
  const synergies = detectSynergies(activePerkIds).map((s) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
  }));

  return {
    runId: run.id,
    seed: run.seed,
    className: run.className,
    currentFloor: run.currentFloor,
    hp: run.hp,
    maxHp: run.maxHp,
    atk: run.atk,
    def: run.def,
    energy: run.energy,
    maxEnergy: run.maxEnergy,
    perks,
    activePerkIds,
    synergies,
    pactAmount: run.pactAmount,
    coinsInRun: run.coinsInRun,
    status: run.status as RunState['status'],
    currentFloorEvent: floorEvent,
    rng,
  };
}

/**
 * Pick a perk for the active run.
 */
export async function pickPerk(
  userId: string,
  perkId: string
): Promise<{ state: RunState; newSynergy: boolean }> {
  const run = await prisma.run.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
  if (!run) throw new Error('Aucune descente active.');

  const perk = getPerk(perkId);
  if (!perk) throw new Error('Perk invalide.');

  const currentPerks = run.perks as unknown as Perk[];
  if (currentPerks.some((p) => p.id === perkId)) {
    throw new Error('Tu as déjà ce perk.');
  }

  // Check if this perk triggers a new synergy
  const newSynergies = previewSynergies(
    currentPerks.map((p) => p.id),
    perkId
  );

  // Add perk
  const updatedPerks = [...currentPerks, perk];
  const synergies = detectSynergies(updatedPerks.map((p) => p.id)).map((s) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
  }));

  // Recompute stats
  const classDef = getClass(run.className as ClassId);
  const stats = computeStats(
    classDef.hp,
    classDef.atk,
    classDef.def,
    updatedPerks
  );

  await prisma.run.update({
    where: { id: run.id },
    data: {
      perks: updatedPerks as never,
      synergies: synergies as never,
      maxHp: stats.maxHp,
      atk: stats.atk,
      def: stats.def,
    },
  });

  const state = await loadRun(userId);
  return { state: state!, newSynergy: newSynergies.length > 0 };
}

/**
 * Advance to the next floor.
 */
export async function nextFloor(userId: string): Promise<RunState> {
  const run = await prisma.run.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
  if (!run) throw new Error('Aucune descente active.');

  const newFloor = run.currentFloor + 1;
  const rng = new RNG(run.seed);

  // Replay to new floor
  let floorEvent: FloorEvent | null = null;
  for (let f = 1; f <= newFloor; f++) {
    floorEvent = generateFloor(rng, f);
  }

  const newPact = calculatePact(newFloor, rng);

  // Restore energy
  await prisma.run.update({
    where: { id: run.id },
    data: {
      currentFloor: newFloor,
      energy: run.maxEnergy,
      pactAmount: newPact,
    },
  });

  return (await loadRun(userId))!;
}

/**
 * Quit the run and secure the pact.
 */
export async function quitRun(userId: string): Promise<{
  coinsEarned: bigint;
  xpEarned: number;
  floor: number;
}> {
  const run = await prisma.run.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
  if (!run) throw new Error('Aucune descente active.');

  const coinsEarned = run.pactAmount + BigInt(run.coinsInRun);
  const xpEarned = run.currentFloor * 3;

  await prisma.$transaction([
    prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED_QUIT',
        endedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        coins: { increment: coinsEarned },
        xp: { increment: xpEarned },
        totalRuns: { increment: 1 },
        deepestFloor: { set: Math.max(run.currentFloor, 0) },
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'run_win',
        amount: coinsEarned,
        meta: { runId: run.id, floor: run.currentFloor, seed: run.seed },
      },
    }),
  ]);

  logger.info({ userId, coinsEarned: coinsEarned.toString(), floor: run.currentFloor }, 'Run quit — coins secured');

  return { coinsEarned, xpEarned, floor: run.currentFloor };
}

/**
 * Player died — end the run with no coins.
 */
export async function deathRun(userId: string): Promise<{
  xpEarned: number;
  floor: number;
}> {
  const run = await prisma.run.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
  if (!run) throw new Error('Aucune descente active.');

  const xpEarned = Math.max(5, run.currentFloor);

  await prisma.$transaction([
    prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED_DEAD',
        endedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        souls: { increment: 1 },
        xp: { increment: xpEarned },
        totalRuns: { increment:  1},
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'run_loss',
        amount: 0n,
        meta: { runId: run.id, floor: run.currentFloor, seed: run.seed },
      },
    }),
  ]);

  logger.info({ userId, floor: run.currentFloor }, 'Run ended — death');

  return { xpEarned, floor: run.currentFloor };
}

/**
 * Get 3 (or 4 with Explorer perk) random perks to choose from.
 */
export async function getPerkChoices(
  userId: string,
  amount: number = 3
): Promise<Perk[]> {
  const run = await prisma.run.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
  if (!run) throw new Error('Aucune descente active.');

  const currentPerkIds = (run.perks as unknown as Perk[]).map((p) => p.id);
  const availablePerks = getAllPerkIds()
    .filter((id) => !currentPerkIds.includes(id))
    .map((id) => getPerk(id)!)
    .filter(Boolean);

  // Use run seed for deterministic perk choices
  const rng = new RNG(run.seed + run.currentFloor * 1000);
  return rng.pickN(availablePerks, Math.min(amount, availablePerks.length));
}
