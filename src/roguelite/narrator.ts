/**
 * NEXUS — Narrative: Procedural emergent narration
 * Generates atmospheric text that gives personality to runs.
 */

import { RNG } from '../roguelite/rng.js';
import { getBiome } from '../roguelite/biomes.js';

const NARRATION_BIOME_ENTRY: Record<string, string[]> = {
  forest: [
    'Tu descends dans la forêt ancienne. L\'air est humide, les arbres géants cachent la lumière.',
    'Des champignons bioluminescents éclairent ton chemin. Tu entends un grondement au loin.',
    'La mousse couvre les murs de pierre. Quelque chose t\'observe depuis les ombres.',
  ],
  ice_caves: [
    'La température chute brutalement. Ton souffle forme des nuages. La glace craque sous tes pieds.',
    'Des cristaux géants jaillissent du sol comme des dents. Le silence est total.',
    'Tu marches sur un lac gelé. Des formes sombres se déplacent sous la surface.',
  ],
  fire_depths: [
    'La chaleur devient insoutenable. La sueur s\'évapore avant même de couler. L\'air tremble.',
    'Des rivières de lave serpentent entre les rochers. Tout est rouge, orange, brûlant.',
    'Le sol lui-même semble vivant. Des geysers de feu jaillissent sans prévenir.',
  ],
  cosmic_void: [
    'La réalité se déforme. Les couleurs n\'ont plus de sens. Tu entendais des voix qui n\'existent pas.',
    'Le néant absolu. Pas de haut, pas de bas. Des étoiles meurent autour de toi.',
    'Quelque chose d\'immense se mouvait dans l\'obscurité entre les étoiles. Tu ne devrais pas être ici.',
  ],
  dead_realm: [
    'Le royaume des morts. Le silence est absolu. Même ton cœur semble s\'être arrêté.',
    'Des ossements jonchent le sol à perte de vue. Des âmes errantes te fixent sans yeux.',
    'La faucheuse elle-même t\'observe depuis son trône d\'os. Elle sourit.',
  ],
};

const NARRATION_COMBAT_START = [
  'L\'ennemi surgit des ombres !',
  'Un bruit de pas derrière toi. Tu te retournes — trop tard.',
  'Les yeux luisent dans l\'obscurité. Pas le temps de fuir.',
  'Le sol tremble. Quelque chose approche. Quelque chose de gros.',
  'Une ombre se détache du mur. Elle a une forme. Elle a des dents.',
];

const NARRATION_COMBAT_WIN = [
  'L\'ennemi s\'effondre dans un dernier râle. Tu reprends ton souffle.',
  'Victoire. Mais tu sais que ce n\'est que le début.',
  'Le silence retombe. Plus profond qu\'avant.',
  'Tu essuies ton arme. Il y en aura d\'autres.',
];

const NARRATION_COMBAT_LOSS = [
  'Ton sang coule sur la pierre froide. L\'obscurité t\'avale.',
  'Tu tombes. Le dernier son que tu entends est un rire.',
  'La douleur s\'éteint. Tout s\'éteint.',
];

const NARRATION_DEATH = [
  'Tes yeux se ferment. Les profondeurs te revendiquent.',
  'Un autre aventurier viendra. Peut-être fera-t-il mieux. Probablement pas.',
  'Ici gît {username}. {username} a fait de son mieux. {username} n\'est plus.',
  'Le néant. Enfin le repos. Mais non — les âmes n\'ont pas de repos ici.',
];

const NARRATION_SHOP = [
    'Un marchand est là. Il te regarde avec des yeux avides. "Ça t\'intéresse ?"',
    'Une boutique abandonnée. Poussiéreuse. Mais les prix sont encore visibles.',
    'Le marchand sourit. Ses dents sont en or. "Pour toi, prix spécial."',
];

const NARRATION_PUZZLE = [
    'Une inscription ancienne brille sur le mur. Un puzzle. Les anciens aimaient jouer.',
    'Une porte scellée par une énigme. La réflexion est ta seule arme ici.',
    'Des symboles gravés dans la roche. Ils forment un message. Lequel ?',
];

const NARRATION_BOSS = [
    'L\'air devient lourd. Tu sens une présence colossale. Le boss t\'attend.',
    'Le sol tremble à chaque pas. Ce qui t\'attend n\'est pas comme les autres.',
    'Tu entres dans une salle immense. Au centre, quelque chose de terrible.',
];

/**
 * Generate a narration line for a given context.
 */
export function narrate(context: 'biome_enter' | 'combat_start' | 'combat_win' | 'combat_loss' | 'death' | 'shop' | 'puzzle' | 'boss', rng: RNG, floor: number, username?: string): string {
  switch (context) {
    case 'biome_enter': {
      const biome = getBiome(floor);
      const lines = NARRATION_BIOME_ENTRY[biome.id] ?? NARRATION_BIOME_ENTRY.forest;
      return rng.pick(lines);
    }
    case 'combat_start':
      return rng.pick(NARRATION_COMBAT_START);
    case 'combat_win':
      return rng.pick(NARRATION_COMBAT_WIN);
    case 'combat_loss':
      return rng.pick(NARRATION_COMBAT_LOSS);
    case 'death': {
      let line = rng.pick(NARRATION_DEATH);
      if (username) line = line.replace(/\{username\}/g, username);
      return line;
    }
    case 'shop':
      return rng.pick(NARRATION_SHOP);
    case 'puzzle':
      return rng.pick(NARRATION_PUZZLE);
    case 'boss':
      return rng.pick(NARRATION_BOSS);
    default:
      return '';
  }
}
