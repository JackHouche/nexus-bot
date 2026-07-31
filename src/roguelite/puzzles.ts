/**
 * Puzzle Resolver — pure logic for 5 puzzle variants.
 * Each puzzle generates a challenge and can validate an answer.
 */

import { RNG } from './rng.js';

export type PuzzleVariant = 'sequence' | 'anagram' | 'memory' | 'math_rush' | 'pattern';

export interface PuzzleChallenge {
  variant: PuzzleVariant;
  /** The question/prompt shown to the player */
  prompt: string;
  /** Accepted answer(s) — exact match (case-insensitive) */
  answers: string[];
  /** Time limit in seconds */
  timeLimit: number;
  /** Hint for the player (optional, shown if requested) */
  hint?: string;
  /** Data for UI rendering (e.g. memory sequence) */
  displayData?: string[];
  /** Reward for correct answer */
  rewardHp: number;
  /** Penalty for wrong answer / timeout */
  penaltyHp: number;
}

/**
 * Generate a number sequence puzzle.
 * e.g. "1, 1, 2, 3, 5, 8, ?" → answer: 13 (Fibonacci)
 */
function genSequence(rng: RNG): PuzzleChallenge {
  const types = ['fibonacci', 'arithmetic', 'geometric', 'square'] as const;
  const type = rng.pick(types);

  let sequence: number[] = [];
  let answer: string;
  let prompt = '';

  switch (type) {
    case 'fibonacci': {
      const start = rng.int(1, 3);
      let a = start, b = start + 1;
      sequence = [a, b];
      for (let i = 0; i < 3; i++) {
        const next = a + b;
        sequence.push(next);
        a = b;
        b = next;
      }
      answer = String(a + b);
      prompt = `Quelle est la suite logique ?\n\`${sequence.join(', ')}, ?\``;
      break;
    }
    case 'arithmetic': {
      const start = rng.int(2, 10);
      const diff = rng.int(2, 7);
      sequence = [start, start + diff, start + 2 * diff, start + 3 * diff, start + 4 * diff];
      answer = String(start + 5 * diff);
      prompt = `Quelle est la suite logique ?\n\`${sequence.join(', ')}, ?\``;
      break;
    }
    case 'geometric': {
      const start = rng.int(2, 4);
      const ratio = rng.int(2, 3);
      sequence = Array.from({ length: 5 }, (_, i) => start * Math.pow(ratio, i));
      answer = String(start * Math.pow(ratio, 5));
      prompt = `Quelle est la suite logique ?\n\`${sequence.join(', ')}, ?\``;
      break;
    }
    case 'square': {
      const start = rng.int(1, 4);
      sequence = [start * start, (start + 1) * (start + 1), (start + 2) * (start + 2), (start + 3) * (start + 3)];
      answer = String((start + 4) * (start + 4));
      prompt = `Quelle est la suite logique ?\n\`${sequence.join(', ')}, ?\``;
      break;
    }
  }

  return {
    variant: 'sequence',
    prompt,
    answers: [answer],
    timeLimit: 60,
    hint: type === 'fibonacci' ? 'Indice : Chaque nombre est la somme des deux précédents' : 'Indice : Cherche la règle entre les nombres',
    rewardHp: 20,
    penaltyHp: -10,
  };
}

/**
 * Generate a French anagram puzzle.
 */
function genAnagram(rng: RNG): PuzzleChallenge {
  const words = [
    { word: 'DRAGON', display: 'GRANDO' },
    { word: 'EPEE', display: 'EPEE' },
    { word: 'MAGE', display: 'GAME' },
    { word: 'SORT', display: 'TORS' },
    { word: 'ORACLE', display: 'CLAREO' },
    { word: 'CROIX', display: 'ROIXC' },
    { word: 'DAGUE', display: 'GAUDE' },
    { word: 'BOUCLIER', display: 'BOUCLIER' },
    { word: 'POTION', display: 'TOPION' },
    { word: 'GOUVERNAIL', display: 'ROUGENVAIL' },
  ];
  const challenge = rng.pick(words);
  // Scramble the word properly if the display is same
  const scramble = (s: string) => s.split('').sort(() => Math.random() - 0.5).join('');
  const display = challenge.display === challenge.word ? scramble(challenge.word) : challenge.display;

  return {
    variant: 'anagram',
    prompt: `Quel mot se cache derrière cet anagramme ?\n\`${display}\``,
    answers: [challenge.word, challenge.word.toLowerCase()],
    timeLimit: 60,
    hint: `Indice : ${challenge.word.length} lettres, thème fantasy`,
    rewardHp: 20,
    penaltyHp: -10,
  };
}

/**
 * Generate a memory puzzle — memorize an emoji sequence.
 */
function genMemory(rng: RNG): PuzzleChallenge {
  const emojis = ['🔥', '⚔️', '🛡️', '💀', '❤️', '⚡', '🎯', '💎'];
  const length = rng.int(3, 5);
  const sequence = rng.pickN(emojis, length);

  return {
    variant: 'memory',
    prompt: `Mémorise cette séquence, puis tape-la dans l'ordre (sans espaces) :`,
    answers: [sequence.join('')],
    timeLimit: 45,
    hint: `Indice : ${length} emojis`,
    displayData: sequence,
    rewardHp: 25,
    penaltyHp: -10,
  };
}

/**
 * Generate a math rush puzzle — solve quick mental math.
 */
function genMathRush(rng: RNG): PuzzleChallenge {
  const ops = ['+', '-', '*'] as const;
  const op = rng.pick(ops);
  let a: number, b: number, answer: number;

  switch (op) {
    case '+':
      a = rng.int(15, 99);
      b = rng.int(15, 99);
      answer = a + b;
      break;
    case '-':
      a = rng.int(50, 99);
      b = rng.int(10, 49);
      answer = a - b;
      break;
    case '*':
      a = rng.int(3, 12);
      b = rng.int(3, 12);
      answer = a * b;
      break;
  }

  return {
    variant: 'math_rush',
    prompt: `Calcule rapidement !\n\`${a} ${op} ${b} = ?\``,
    answers: [String(answer)],
    timeLimit: 30,
    hint: undefined,
    rewardHp: 15,
    penaltyHp: -10,
  };
}

/**
 * Generate a pattern puzzle — which emoji completes the series?
 */
function genPattern(rng: RNG): PuzzleChallenge {
  const patterns = [
    { sequence: ['🔥', '🔥', '❄️', '🔥', '🔥', '?'], answer: ['❄️'], hint: 'Alternance' },
    { sequence: ['⬆️', '➡️', '⬇️', '⬅️', '?'], answer: ['⬆️'], hint: 'Rotation horaire' },
    { sequence: ['1️⃣', '2️⃣', '1️⃣', '3️⃣', '1️⃣', '?'], answer: ['4️⃣'], hint: 'Intercale' },
    { sequence: ['🌑', '🌒', '🌓', '🌔', '?'], answer: ['🌕'], hint: 'Phases' },
  ];
  const p = rng.pick(patterns);

  return {
    variant: 'pattern',
    prompt: `Quel emoji complète la série ?\n\`${p.sequence.join(' ')}\``,
    answers: p.answer,
    timeLimit: 45,
    hint: `Indice : ${p.hint}`,
    rewardHp: 20,
    penaltyHp: -10,
  };
}

/**
 * Master generator — dispatches to the right puzzle variant.
 */
export function generatePuzzle(rng: RNG): PuzzleChallenge {
  const variants: PuzzleVariant[] = ['sequence', 'anagram', 'memory', 'math_rush', 'pattern'];
  const variant = rng.pick(variants);

  switch (variant) {
    case 'sequence': return genSequence(rng);
    case 'anagram': return genAnagram(rng);
    case 'memory': return genMemory(rng);
    case 'math_rush': return genMathRush(rng);
    case 'pattern': return genPattern(rng);
    default: return genSequence(rng);
  }
}

/**
 * Validate a player's answer against the puzzle.
 */
export function validateAnswer(puzzle: PuzzleChallenge, answer: string): boolean {
  const normalized = answer.trim().toLowerCase().replace(/\s+/g, '');
  return puzzle.answers.some((a) => a.trim().toLowerCase().replace(/\s+/g, '') === normalized);
}

/**
 * Get puzzle result — reward or penalty.
 */
export function getPuzzleResult(puzzle: PuzzleChallenge, solved: boolean): { hpChange: number; message: string } {
  if (solved) {
    return {
      hpChange: puzzle.rewardHp,
      message: `✅ Correct ! +${puzzle.rewardHp} HP`,
    };
  }
  return {
    hpChange: puzzle.penaltyHp,
    message: `❌ Incorrect ! La réponse était: ${puzzle.answers[0]}. ${puzzle.penaltyHp} HP`,
  };
}
