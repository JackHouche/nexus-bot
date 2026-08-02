/**
 * NEXUS — Auto-moderation engine
 * Detects banned words, spam, mass mentions, and suspicious links.
 */

import type { Message } from 'discord.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

// ============================================================
//  BANNED WORDS (normalized ASCII form — accents/leetspeak stripped)
// ============================================================

export const BANNED_WORDS: string[] = [
  // ── Racial slurs (EN / FR) ──
  'nigger', 'nigga', 'negro', 'negre', 'négro', 'nègre',
  // ── Homophobic / transphobic ──
  'faggot', 'fag', 'pd', 'pédé', 'pede', 'tapette', 'fiotte',
  'tranny', 'trannie', 'shemale',
  // ── Extreme insults (EN / FR) ──
  'cunt', 'whore', 'bitch', 'slut', 'retard', 'retarded',
  'enculé', 'encule', 'connard', 'connasse', 'salope', 'pute',
  'bâtard', 'batard', 'ntm', 'fdp', 'nique ta mere',
  // ── Predatory ──
  'pedophile', 'pédophile', 'pdophile',
];

// ============================================================
//  SUSPICIOUS LINK PATTERNS
// ============================================================

/** Regex patterns that always indicate malicious content. */
export const SUSPICIOUS_LINK_PATTERNS: RegExp[] = [
  // Discord phishing domains (typosquats of discord.com)
  /discor[d]+\.(?:click|gift|cf|ga|tk|xyz|info|cc|net|pro)/i,
  // Fake Nitro giveaways / generators
  /free\s*(?:discord\s*)?nitro/i,
  /nitro\s*(?:generator|free|claim|airdrop)/i,
  // Steam phishing
  /free\s*steam\s*(?:gift|card|key|wallet|code)/i,
  /steam(?:community)?\.(?:gift|free|card|promo)/i,
  // Generic credential harvesting
  /(?:login|verify|claim)\w*\.(?:tk|ml|ga|cf|xyz)/i,
];

/** VOLT's official Discord invite codes — these are allowed. */
const ALLOWED_INVITE_CODES = ['volt'];

/** Matches any Discord invite link, capturing the invite code. */
const DISCORD_INVITE_REGEX = /discord(?:app)?\.(?:gg|com\/invite|app\.com\/invite)\/([a-zA-Z0-9-]+)/gi;

// ============================================================
//  HELPERS
// ============================================================

/**
 * Normalise text: lowercase, strip accents, convert leetspeak to plain letters.
 * Used only for banned-word matching — never displayed to users.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[@4]/g, 'a')
    .replace(/[3€]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[^a-z\s]/g, '') // remove remaining non-alpha
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pre-compiled banned-word regexes with word boundaries. */
const BANNED_WORD_REGEXES: RegExp[] = BANNED_WORDS.map((word) => {
  const normalised = normalizeText(word);
  const escaped = normalised.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
});

// ============================================================
//  TYPES
// ============================================================

export interface AutoModResult {
  action: 'allow' | 'warn' | 'delete' | 'mute';
  reason: string;
}

interface TrackedMessage {
  content: string;
  timestamp: number;
}

// ============================================================
//  SPAM TRACKING
// ============================================================

const SPAM_KEY = (userId: string) => `spam:user:${userId}`;
const SPAM_TTL = 60; // seconds
const SPAM_WINDOW = 30_000; // 30 s
const SPAM_THRESHOLD = 3; // 3 identical messages
const MAX_TRACKED = 5;

/**
 * Track a user's message in Redis for spam detection.
 * Stores the last 5 messages with timestamps, TTL 60 s.
 */
export async function trackUserMessages(userId: string, content: string): Promise<void> {
  const key = SPAM_KEY(userId);
  const raw = await redis.get(key);
  const messages: TrackedMessage[] = raw ? JSON.parse(raw) as TrackedMessage[] : [];

  messages.push({ content: normalizeText(content), timestamp: Date.now() });
  const trimmed = messages.slice(-MAX_TRACKED);

  await redis.set(key, JSON.stringify(trimmed), 'EX', SPAM_TTL);
}

/**
 * Check tracked messages for spam (3+ identical within 30 s window).
 * Returns the count of identical messages in the window, or 0.
 */
async function checkSpam(userId: string, normalizedContent: string): Promise<number> {
  const raw = await redis.get(SPAM_KEY(userId));
  if (!raw) return 0;

  const messages = JSON.parse(raw) as TrackedMessage[];
  const now = Date.now();
  const recent = messages.filter((m) => now - m.timestamp < SPAM_WINDOW);
  return recent.filter((m) => m.content === normalizedContent).length;
}

// ============================================================
//  MESSAGE CHECK
// ============================================================

/**
 * Evaluate a message against all auto-mod rules.
 * The caller should call `trackUserMessages` first, then `checkMessage`.
 */
export async function checkMessage(message: Message): Promise<AutoModResult> {
  const content = message.content;
  const normalized = normalizeText(content);

  // ── 1. Banned words ──
  for (const regex of BANNED_WORD_REGEXES) {
    if (regex.test(normalized)) {
      return { action: 'delete', reason: 'Mot interdit détecté' };
    }
  }

  // ── 2. Suspicious link patterns ──
  for (const pattern of SUSPICIOUS_LINK_PATTERNS) {
    if (pattern.test(content)) {
      return { action: 'delete', reason: 'Lien suspect détecté (phishing / scam)' };
    }
  }

  // ── 3. Discord invite links (unless VOLT's own) ──
  const inviteRegex = new RegExp(DISCORD_INVITE_REGEX.source, 'gi');
  let inviteMatch: RegExpExecArray | null;
  while ((inviteMatch = inviteRegex.exec(content)) !== null) {
    const code = inviteMatch[1];
    if (!ALLOWED_INVITE_CODES.includes(code.toLowerCase())) {
      return { action: 'delete', reason: `Lien d'invitation Discord non autorisé (discord.gg/${code})` };
    }
  }

  // ── 4. Mass mentions (5+) ──
  let mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (message.mentions.everyone) mentionCount += 1;
  if (mentionCount >= 5) {
    return { action: 'warn', reason: `Mass mention détectée (${mentionCount} mentions)` };
  }

  // ── 5. Spam (3+ identical messages in 30 s) ──
  const spamCount = await checkSpam(message.author.id, normalized);
  if (spamCount >= SPAM_THRESHOLD) {
    return { action: 'mute', reason: `Spam détecté (${spamCount} messages identiques en 30s)` };
  }

  return { action: 'allow', reason: '' };
}

// ============================================================
//  ACTION EXECUTION
// ============================================================

/** Auto-mod mute duration in milliseconds. */
const AUTO_MUTE_DURATION = 10 * 60 * 1000; // 10 min

/**
 * Execute an auto-mod action on a message.
 * - delete  → delete the message
 * - warn    → reply with a warning
 * - mute    → delete + timeout the member
 */
export async function handleAutoModAction(
  message: Message,
  result: AutoModResult,
): Promise<void> {
  if (result.action === 'allow') return;

  const { action, reason } = result;
  const author = message.author;

  try {
    if (action === 'delete' || action === 'mute') {
      await message.delete().catch(() => {});
    }

    if (action === 'warn') {
      await message.reply({
        content: `⚠️ ${author.toString()}, attention ! ${reason}`,
        allowedMentions: { users: [author.id] },
      }).catch(() => {});
    }

    if (action === 'mute') {
      const member = message.member;
      if (member && member.moderatable) {
        await member.timeout(AUTO_MUTE_DURATION, `AutoMod: ${reason}`).catch(() => {});
      }
      if (message.channel.isTextBased()) {
        await (message.channel as import('discord.js').TextChannel).send({
          content: `🔇 ${author.toString()} a été réduit au silence par **AutoMod** — ${reason}`,
          allowedMentions: { users: [] },
        }).catch(() => {});
      }
    }

    logger.warn(
      { userId: author.id, action, reason, channel: message.channelId },
      'AutoMod action executed',
    );
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to execute AutoMod action');
  }
}
