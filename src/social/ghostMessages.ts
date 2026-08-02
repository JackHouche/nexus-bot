/**
 * Dark Souls-style soapstone messages — players leave short messages at floors
 * for others to discover on the same seed. Messages can be upvoted/downvoted;
 * highly-rated messages appear "praised" (golden), and heavily-downvoted ones
 * fade away.
 *
 * Visibility rules:
 *  - score > -2 : visible
 *  - score > 5  : "praised" (golden color)
 *  where score = upvotes - downvotes
 */

import { prisma } from '../database.js';

/** Messages expire after this many hours. */
export const MESSAGE_TTL_HOURS = 24;

/** Score below which a message is hidden. */
export const MESSAGE_HIDE_THRESHOLD = -2;

/** Score above which a message is "praised". */
export const MESSAGE_PRAISE_THRESHOLD = 5;

/** Maximum message length. */
export const MAX_MESSAGE_LENGTH = 120;

export interface GhostMessageRecord {
  id: string;
  userId: string;
  username: string;
  seed: number;
  floor: number;
  message: string;
  upvotes: number;
  downvotes: number;
  /** score = upvotes - downvotes */
  score: number;
  voters: string[];
  expiresAt: Date;
  createdAt: Date;
  /** Derived: is this message praised (score > threshold)? */
  praised: boolean;
}

export interface VoteResult {
  messageId: string;
  upvotes: number;
  downvotes: number;
  score: number;
  praised: boolean;
  /** Did the voter change their vote? */
  changed: boolean;
}

/**
 * Leave a message at a floor for other players on the same seed to find.
 * Messages expire after 24 hours.
 *
 * @param userId  Discord user ID of the author.
 * @param seed    Run seed.
 * @param floor   Floor number.
 * @param message The message text.
 */
export async function leaveMessage(
  userId: string,
  seed: number,
  floor: number,
  message: string
): Promise<GhostMessageRecord> {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new Error('Le message ne peut pas être vide.');
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Le message est trop long (${trimmed.length}/${MAX_MESSAGE_LENGTH} caractères).`
    );
  }

  const expiresAt = new Date(Date.now() + MESSAGE_TTL_HOURS * 60 * 60 * 1000);

  const msg = await prisma.ghostMessage.create({
    data: {
      userId,
      seed,
      floor,
      message: trimmed,
      expiresAt,
    },
    include: { user: true },
  });

  return toRecord(msg);
}

/**
 * Find active (non-expired, visible) messages at a given floor/seed.
 * Messages with score <= hide threshold are excluded.
 *
 * @param seed  Run seed.
 * @param floor Floor number.
 */
export async function findMessagesAtFloor(
  seed: number,
  floor: number
): Promise<GhostMessageRecord[]> {
  const now = new Date();

  const messages = await prisma.ghostMessage.findMany({
    where: { seed, floor, expiresAt: { gt: now } },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  return messages
    .map(toRecord)
    .filter((m: GhostMessageRecord) => m.score > MESSAGE_HIDE_THRESHOLD);
}

/**
 * Vote on a message. A voter can change their vote (from up to down or vice
 * versa) but cannot double-vote in the same direction — re-voting the same
 * direction is a no-op.
 *
 * @param userId    Discord user ID of the voter.
 * @param messageId Message ID.
 * @param isUpvote  true = upvote, false = downvote.
 */
export async function voteOnMessage(
  userId: string,
  messageId: string,
  isUpvote: boolean
): Promise<VoteResult> {
  const msg = await prisma.ghostMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) throw new Error('Ce message n\'existe plus.');
  if (msg.userId === userId) {
    throw new Error('Tu ne peux pas voter pour ton propre message.');
  }

  const voters = msg.voters ?? [];
  let upvotes = msg.upvotes;
  let downvotes = msg.downvotes;
  let changed = false;

  if (voters.includes(userId)) {
    // Voter already voted. Check current direction by looking at stored data.
    // We store the voter as `${userId}:up` or `${userId}:down` to track direction.
    // However the schema stores plain voter IDs, so we re-derive from vote delta.
    // Since we can't store direction in the array, we toggle: if the voter
    // already exists and votes the same direction, it's a no-op. Otherwise
    // we flip the vote.
    //
    // To support direction tracking without schema changes, we encode the
    // direction in the voters array using a prefix convention.
    // NOTE: This is handled below using encoded entries.

    // Not used — see encoding below.
  }

  // We use encoded voter entries: "u:<userId>" for upvote, "d:<userId>" for downvote.
  const upEntry = `u:${userId}`;
  const downEntry = `d:${userId}`;

  const currentVoters = msg.voters ?? [];
  const hadUp = currentVoters.includes(upEntry);
  const hadDown = currentVoters.includes(downEntry);

  if (isUpvote) {
    if (hadUp) {
      // Same vote — no-op.
      const score = upvotes - downvotes;
      return {
        messageId,
        upvotes,
        downvotes,
        score,
        praised: score > MESSAGE_PRAISE_THRESHOLD,
        changed: false,
      };
    }
    if (hadDown) {
      // Flip from down to up.
      downvotes -= 1;
      upvotes += 1;
      currentVoters.splice(currentVoters.indexOf(downEntry), 1);
      currentVoters.push(upEntry);
      changed = true;
    } else {
      upvotes += 1;
      currentVoters.push(upEntry);
      changed = true;
    }
  } else {
    if (hadDown) {
      // Same vote — no-op.
      const score = upvotes - downvotes;
      return {
        messageId,
        upvotes,
        downvotes,
        score,
        praised: score > MESSAGE_PRAISE_THRESHOLD,
        changed: false,
      };
    }
    if (hadUp) {
      // Flip from up to down.
      upvotes -= 1;
      downvotes += 1;
      currentVoters.splice(currentVoters.indexOf(upEntry), 1);
      currentVoters.push(downEntry);
      changed = true;
    } else {
      downvotes += 1;
      currentVoters.push(downEntry);
      changed = true;
    }
  }

  await prisma.ghostMessage.update({
    where: { id: messageId },
    data: {
      upvotes,
      downvotes,
      voters: currentVoters,
    },
  });

  const score = upvotes - downvotes;
  return {
    messageId,
    upvotes,
    downvotes,
    score,
    praised: score > MESSAGE_PRAISE_THRESHOLD,
    changed,
  };
}

// ---------------------------------------------------------------------------
//  Internal helpers
// ---------------------------------------------------------------------------

function toRecord(row: {
  id: string;
  userId: string;
  user: { username: string } | null;
  seed: number;
  floor: number;
  message: string;
  upvotes: number;
  downvotes: number;
  voters: string[];
  expiresAt: Date;
  createdAt: Date;
}): GhostMessageRecord {
  const score = row.upvotes - row.downvotes;
  return {
    id: row.id,
    userId: row.userId,
    username: row.user?.username ?? 'Fantôme',
    seed: row.seed,
    floor: row.floor,
    message: row.message,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    score,
    voters: row.voters,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    praised: score > MESSAGE_PRAISE_THRESHOLD,
  };
}
