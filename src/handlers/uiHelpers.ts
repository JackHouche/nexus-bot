/**
 * Shared UI helpers for NEXUS bot — colors, HP bars, button chunking.
 */

import { ButtonBuilder, ActionRowBuilder } from 'discord.js';

export const COLORS = {
  combat: 0xe63946,
  gamble: 0xffb627,
  puzzle: 0x06d6a0,
  dilemma: 0x9b59b6,
  shop: 0xf39c12,
  boss: 0x8b0000,
  death: 0x1a1a2e,
  victory: 0x00d9a3,
  perk: 0x4361ee,
  meta: 0x2d1b4e,
} as const;

export function hpBar(current: number, max: number): string {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * 10);
  const empty = 10 - filled;
  return `❤️ ${'█'.repeat(filled)}${'░'.repeat(empty)} ${current}/${max}`;
}

export function chunkButtons(
  buttons: ButtonBuilder[]
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5))
    );
  }
  return rows;
}
