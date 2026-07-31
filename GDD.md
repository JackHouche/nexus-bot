# 🎮 NEXUS — Game Design Document v1.0

> **"Un seul bot. Une seule mécanique. Rejouabilité infinie."**
> Roguelite Discord communautaire où chaque descente est unique.

---

## 1. VISION GÉNÉRALE

### 1.1 Elevator Pitch
NEXUS est un bot Discord roguelite où tu descends des étages générés procéduralement. À chaque étage : un défi unique (combat, énigme, gamble, dilemme). Tu choisis des perks qui se combinent en synergies explosives. Plus tu descends, plus le pacte grimpe — mais si tu meurs, tu perds tout. *Quit now or risk it all?*

### 1.2 Design Pillars
| Pilier | Description |
|---|---|
| **Tension permanente** | Chaque étage = un mini deal-or-no-deal. Le risque émotionnel est réel. |
| **Rejouabilité infinie** | Génération procédurale + 60+ perks + synergies émergentes = aucune run identique. |
| **Runs courts** | 3-8 minutes par run. "Juste une dernière" → 15 runs plus tard. |
| **Métaprogression addictive** | Entre les runs : débloquer classes, perks, cosmétiques. Toujours un objectif suivant. |
| **Social viral** | Leaderboards, duels, partage de builds, moments "j'aurais dû quitter à l'étage 12". |

### 1.3 Audience
Communautés Discord gaming (15-35 ans), joueurs casual qui aiment les loops courtes avec profondeur émergente (public Balatro, Slay the Spire, Hades).

---

## 2. CORE LOOP

```
    ┌──────────────────────────────────────────────────────────┐
    │                                                          │
    │   1. /descent → Choix de classe → Run commence          │
    │                    │                                     │
    │                    ▼                                     │
    │   2. 🏚️ ÉTAGE (combat/énigme/gamble/event/shop)         │
    │                    │                                     │
    │                    ▼                                     │
    │   3. 🎁 Récompense : choisir 1 perk parmi 3             │
    │                    │                                     │
    │                    ▼                                     │
    │   4. ⚠️ QUIT OR CONTINUE ?                               │
    │          ├─ QUIT → +pacte sécurisé → fin de run         │
    │          └─ CONTINUE → étage suivant, pacte x1.5-3      │
    │                    │                                     │
    │                    ▼                                     │
    │   5. 💀 Death = perte du pacte (mais XP/meta conservés)  │
    │          OU                                             │
    │   ✅ Quit = monnaie sécurisée dans le wallet             │
    │                    │                                     │
    │                    ▼                                     │
    │   6. 🏠 Meta-hub : shop, unlocks, leaderboard            │
    │                    │                                     │
    └────────────────────┘ (rejoue avec nouveaux unlocks)
```

### 2.1 Temps moyen par étape
| Étape | Temps |
|---|---|
| Choix de classe | 10s |
| Étage (event) | 30-90s |
| Choix de perk | 10s |
| Décision quit/continue | 5-15s |
| **Run complet (10-15 étages)** | **~5 min** |

---

## 3. SYSTÈME ROGUELITE — LE MOTEUR

### 3.1 Génération procédurale

Chaque run reçoit un **seed** entier déterministe. À partir du seed, un PRNG (mulberry32) génère :
- La séquence des types d'étages
- Les ennemis rencontrés
- Le contenu des events
- Les perks proposés

**Pourquoi du déterministe ?** Reproductibilité (pour debug et tournois), partage de seed ("essaie le seed 4827, il est fou").

### 3.2 Structure d'un run

```
ÉTAGE 1-3   : Tutoriel doux — ennemis faibles, events simples
ÉTAGE 4-7   : Difficulté montante — premiers choix tendus
ÉTAGE 8-12  : Mid-game — builds prennent forme, synergies apparaissent
ÉTAGE 13-20 : Late-game — ennemis brutaux, pacte énorme, vrai dilemme
ÉTAGE 21+   : Endless — scaling infini pour les fous
```

### 3.3 Types d'étages

#### 🗡️ COMBAT (35% des étages)
Combat au tour par tour contre 1-3 ennemis.

**Système de combat simplifié :**
```
Tes stats:
  ❤️ HP: 80/100
  ⚔️ ATK: 15
  🛡️ DEF: 5
  🔥 PUISSANCE (multiplieur de dégâts): x1.0

Action du tour:
  ⚔️ Attaquer (ATK × PUISSANCE × perk modifiers)
  🛡️ Défendre (réduit dégâts reçus de 50% ce tour, soigne 5 HP)
  💥 Spécial (coûte de l'énergie, effet selon classe/perks)
  🏃 Fuir (30% chance, échec = recevoir un coup gratuit)
```

#### 🎰 GAMBLE (20% des étages)
Un mini-jeu de casino avec enjeu immédiat.

Variantes :
- **Double or Nothing** : Pile ou face. Gagne = pacte x1.5. Perd = -25% HP.
- **Dice Duel** : Tu lance 2d6 vs dealer 2d6. Plus haut gagne. Mise HP.
- **Wheel of Pain** : Roue avec 8 segments. 6 bons, 2 mauvais (gros dégâts).
- **Mystery Chest** : 3 coffres. 1 contient un perk rare, 1 contient des dégâts, 1 est vide.

#### 🧩 ÉNIGME (15% des étages)
Défi de logique/réflexion sous pression temporelle (60s).

Variantes :
- **Sequence** : Trouve le prochain nombre dans la suite (1,1,2,3,5,8,? → 13)
- **Anagramme** : Un mot mélangé à recomposer (FR cryptés)
- **Memory** : Mémorise une séquence d'emojis, la reproduire
- **Math Rush** : 5 calculs mentaux en 30s
- **Pattern** : Quel emoji complète la série logique ?

Succès = bonus (heal ou perk extra). Échec = dégâts légers.

#### 🎭 DILEMME MORAL (15% des étages)
Un choix narratif avec conséquences.

Exemples :
```
🚪 Un marchand blessé te propose un deal :
   A) L'aider → -10% HP mais il te donne un perk aléatoire
   B) L'ignorer → rien ne se passe
   C) Le voler → gagne 500 coins mais +1 Malédiction (mauvaise fortune)
   
🐺 Un loup blessé bloque le passage :
   A) Combattre (combat normal)
   B) Lui lancer de la nourriture (coûte 200 coins, passe sans combat)
   C) Utiliser Charisme (nécessite perk spécifique, gagne un allié)
```

#### 🏪 SHOP (10% des étages)
Achète avec les coins de ta run (pas le wallet global).

```
🏪 BOUTIQUE DE L'ÉTAGE
├─ 🧪 Potion de soin (+40 HP) ............ 150 ¢
├─ ⚗️ Potion de force (+5 ATK permanent) . 300 ¢
├─ 🗝️ Clef mystère (débloque étage bonus) . 500 ¢
├─ ♻️ Reroll perks (change tes choix) .... 200 ¢
└─ 💎 Relique aléatoire .................. 400 ¢
```

#### ⭐ RELIQUE / BOSS (5% des étages — tous les 5 étages)
Combat contre un boss ou découverte d'une relique puissante.

Boss tous les 5 étages (5, 10, 15, 20...) avec mécaniques uniques :
- **Étage 5** : Le Garde (gros HP, attaque prévisible)
- **Étage 10** : La Sorcière (inflige des malédictions, dispel requis)
- **Étage 15** : Le Joueur (imitent tes stats +10%)
- **Étage 20** : Le Miroir (copie tes perks, difficile)
- **Étage 25** : L'Architecte (modifie les règles du combat)

Récompense boss : Relique garantie + gros boost de pacte.

---

## 4. CLASSES (4 au lancement, 6 débloquables)

| Classe | HP | ATK | DEF | Spécial | Style |
|---|---|---|---|---|---|
| ⚔️ **Guerrier** | 120 | 18 | 8 | Frappe Puissante (x2 dégâts, coût 2 énergie) | Tanky, consistent |
| 🔥 **Mage** | 70 | 25 | 3 | Boule de Feu (dégâts zone + brûlure DoT) | Glass cannon |
| 🎲 **Gambler** | 90 | 15 | 5 | Chance Activée (reroll 1 dé/event, coût 3 énergie) | RNG favorable |
| 🗡️ **Voleur** | 85 | 20 | 4 | Coups Critiques (25% chance x3 dégâts passif) | DPS précis |

### Classes débloquables (métaprogression)
| Classe | Condition de déblocage | Spécialité |
|---|---|---|
| 🛡️ **Paladin** | Atteindre l'étage 10 | Heal + défense, très lent mais immortel |
| 🧪 **Alchimiste** | 50 runs total | Craft de potions, transforme ressources |
| 💀 **Nécromancien** | Tuer 100 ennemis | Invoque des squelettes, joue lent |
| ☠️ **Berserker** | Mourir 20 fois | Plus HP bas = plus de dégâts |
| 🌟 **Étoile** | Atteindre l'étage 20 | Toutes stats équilibrées + adaptatif |
| 👑 **Roi** | 1000 kills cumulés | Commande des alliés en combat |

---

## 5. SYSTÈME DE PERKS (le cœur de la rejouabilité)

### 5.1 Principe
Après chaque étage réussi, le joueur choisit **1 perk parmi 3** tirés aléatoirement. Les perks sont **permanents pour la durée du run** et se combinent en **synergies**.

### 5.2 Catalogue des perks (60 perks, 6 catégories)

#### 🔥 OFFENSIVE (12 perks)
| Perk | Effet | Synergie notable |
|---|---|---|
| Pyromancie | Dégâts de feu +50% | + Brûlure Persistante = DoT x3 |
| Frappe Rapide | Attaque 2x par tour | + Coups Critiques = machine à crit |
| Attaque Circulaire | Touche tous les ennemis | + Pyromancie = Apocalypse |
| exécution | +50% dégâts si ennemi <30% HP | + Chasseur de Sang = finisher |
| Chasseur de Sang | Marque les ennemis <30% HP | — |
| Onde de Choc | 20% chance de stun l'ennemi | + Frappe Rapide = permastun |
| Frappe Chargée | Ignore DEF ennemie | — |
| Tempête | 15% chance d'attaque bonus | + Frappe Rapide = blitz |
| Empalement | Saignement (DoT physique) | + Pyromancie = double DoT |
| Mutilation | -1 DEF ennemi par tour | — |
| Fureur | +1 ATK par tour de combat | + Régénération = combat infini |
| Frappe Mortelle | 5% chance d'instant kill | + Chance Amplifiée = 15% |

#### 🛡️ DÉFENSIVE (10 perks)
| Perk | Effet |
|---|---|
| Peau de Pierre | +50% DEF |
| Régénération | Soigne 5 HP/tour |
| Bouclier Sacré | Immunise au premier coup de chaque combat |
| parade | 20% chance de bloquer une attaque |
| Dernier Souffle | Survivre à 1 HP une fois par run |
| Cuivre Renforcé | +30 HP max |
| Mur de Fer | Réduit dégâts critiques reçus de 75% |
| Armure Épineuse | Reflète 25% des dégâts reçus |
| Endurance | +20% DEF quand HP < 50% |
| Phénix | Ressuscite une fois à 50% HP (une fois par run) |

#### ⚡ UTILITY (10 perks)
| Perk | Effet |
|---|---|
| Voleur Agile | +30% chance de fuite réussie |
| Vision Tactique | Voit le type d'étage suivant avant de choisir |
| Marchandage | -25% prix en shop |
| Explorer | +1 choix de perk (4 au lieu de 3) |
| Clairvoyance | Voit les HP/stats des ennemis |
| Portail | 10% chance de skip un étage |
| Double Sens | Peut faire demi-tour (revenir 1 étage pour re-looter) |
| Chance Dorée | +25% coins en run |
| Économie | Garde 50% du pacte même en mourant |
| Assurance Vie | Récupère 25% des coins dépensés en run si mort |

#### 🎲 RNG / GAMBLE (8 perks)
| Perk | Effet |
|---|---|
| Chance Amplifiée | +10% à toutes les probas favorables |
| Chance du Débutant | Première action de chaque combat = auto-réussite |
| Maître des Dés | Reroll gratuit une fois par étage gamble |
| Roue Dorée | +1 segment favorable à la Wheel of Pain |
| Pile ou Face | Transforme tout échec en 50/50 |
| Bonus Cosmique | Crit +5% toutes les 5 étages descendues |
| Inversion | 15% chance qu'un échec devienne réussite |
| Dés Pipés | +1 au résultat de chaque dé lancé |

#### 💀 MALÉDICTION (10 perks — puissants MAIS avec coût)
| Perk | Effet positif | Effet négatif |
|---|---|---|
| Pacte Démoniaque | +100% ATK | -30% HP max |
| Sang Vampirique | Vole 50% des dégâts en HP | -50% heal reçu |
| Armure Maudite | +100% DEF | Ne peut pas fuir |
| Œil Aveugle | Voir tous les étages à l'avance | -20% dégâts |
| Fièvre | +5 ATK/étage | -5 HP/étage |
| Cristal Fragile | x2 coins de run | Meurt en 1 coup si HP < 20% |
| Berserk Total | x3 dégâts si HP < 25% | Défense = 0 |
Âme Liée | Relique bonus aux boss | Meurt si HP atteint 0 exact (pas arrondi) |
| Double Jeu | +1 perk choix | 10% chance qu'un perk soit remplacé par malédiction |
| Contrat Sanguin | x2 pacte | Pas d'assurancevie possible |

#### 🌟 RELIQUE (10 perks — extraordinaires, rares)
| Perk | Effet |
|---|---|
| Sablier Temporel | Rewind 1 étage (une fois par run) |
| Œil Omniscient | Tous les perks sont révélés avant choix |
| Couronne Royale | Démarre avec 2 perks au lieu de 0 |
| Cœur de Dragon | +200% HP max, -50% heal |
| Lame céleste | Ignore TOUTE défense ennemie |
| Bénédiction Ancienne | Immunité aux malédictions |
| Calice d'Or | Triple coins de run |
| Ailes de Phénix | Revive 2x par run |
| Grimoire Interdit | Apprend l'attaque spéciale d'une autre classe |
| Couronne d'Épines | Les ennemis subissent 10% de leurs HP en dégâts chaque tour |

### 5.3 Système de Synergies (le secret de la rejouabilité)

Les synergies sont détectées automatiquement quand certaines combinaisons de perks sont présentes. Elles déclenchent un **bonus bonus** + un **nom de build** affiché au joueur.

```
┌──────────────────────────────────────────────────────────────┐
│  ⚡ SYNERGIE DÉTECTÉE !                                       │
│  Pyromancie + Brûlure Persistante + Attaque Circulaire       │
│  = "L'APOCALYPSE BRÛLANTE"                                   │
│  Bonus: Tous les ennemis brûlent pour DoT x3 chaque tour     │
│  ──────────────────────────────────────────────────────────  │
│  Partage ce build: /sharebuild                               │
└──────────────────────────────────────────────────────────────┘
```

**30 synergies nommées** au lancement. La découverte d'une synergy inconnue = dopamine massive. Le joueur veut rejouer pour tester des variantes.

Exemples de synergies :
1. **Tempête de Feu** : Pyromancie + Frappe Rapide
2. **Le Mur Infranchissable** : Peau de Pierre + Armure Épineuse + Régénération
3. **Le Parieur** : Chance Amplifiée + Maître des Dés + Roue Dorée
4. **L'Immortel** : Phénix + Dernier Souffle + Régénération
5. **Le Tueur à Gages** : exécution + Chasseur de Sang + Frappe Mortelle
6. **Le Tank Vampirique** : Sang Vampirique + Peau de Pierre + Fureur
7. **Blitzkrieg** : Frappe Rapide + Tempête + Onde de Choc
8. **La Maison Gagne Toujours** : Chance Amplifiée + Dés Pipés + Inversion
...

---

## 6. MÉCANIQUE "QUIT OR CONTINUE"

### 6.1 Principe — le cœur émotionnel

Après chaque étage réussi, le joueur fait face au dilemme :

```
╔══════════════════════════════════════════════╗
║          ⚠️ ÉTAGE 8 RÉUSSI ⚠️               ║
║                                              ║
║   📦 Pacte actuel: $4,200                    ║
║   ❤️ HP restants: 52/100                     ║
║                                              ║
║   🟢 /quit    → Sécurise $4,200 (fin de run) ║
║   🔴 /next    → Étage 9. Pacte potentiel:    ║
║                  $6,300-$10,500              ║
║                  Mais si tu meurs = $0       ║
║                                              ║
║   📊 Étage 9 type: COMBAT (boss mineur)      ║
║      (si tu as Vision Tactique)              ║
╚══════════════════════════════════════════════╝
```

### 6.2 Formule du pacte

```
pacte(étage N) = base × growth^N × variance

base = 100 coins
growth = 1.35 (augmente de 35% par étage)
variance = random(0.8, 1.4) -- imprévisibilité

Exemples:
  Étage 5:  100 × 1.35^5 × ~1.0  ≈ $450
  Étage 10: 100 × 1.35^10 × ~1.0 ≈ $2,000
  Étage 15: 100 × 1.35^15 × ~1.0 ≈ $9,000
  Étage 20: 100 × 1.35^20 × ~1.0 ≈ $40,000
```

### 6.3 Multipliers spéciaux
- **Boss kill**: pacte × 2
- **No-damage floor**: pacte × 1.2
- **Speed bonus** (énigme < 30s): pacte × 1.1
- **Perk "Chance Dorée"**: +25% coins
- **Perk "Calice d'Or"**: ×3 coins

### 6.4 L'aversion à la perte
Le pacte est **visible et grandit visuellement** à chaque étage. C'est la clé psychologique :
- L'utilisateur VOIT son argent potentiel grandir
- Chaque étage le rend plus difficile à abandonner
- Mais le risque augmente aussi (ennemis plus forts)
- Le cerveau humain est programmé pour risquer quand le pot est gros (prospect theory)

---

## 7. MÉTAPROGRESSION (entre les runs)

### 7.1 XP et niveaux de joueur

Chaque action donne de l'XP :
| Action | XP |
|---|---|
| Étage réussi | 10 XP |
| Boss tué | 50 XP |
| Synergie découverte | 30 XP |
| Mort | 5 XP (consolation) |
| Quit sécurisé | Étage × 3 XP |
| Record personnel (profondeur) | 100 XP |

Niveaux : 100 XP par niveau (scaling doux).

### 7.2 Déblocages

| Niveau | Déblocage |
|---|---|
| 1 | Guerrier, Mage, Gambler, Voleur |
| 3 | + 5 perks de départ dans le pool |
| 5 | Paladïn |
| 8 | Shop méta (cosmétiques) |
| 10 | Necromancien |
| 15 | Berserker |
| 20 | Alchimiste |
| 25 | Étoile |
| 30 | Roi |
| 40 | Tous les perks |
| 50 | Mode Hardcore (1 vie, récompenses x5) |
| 75 | Mode Daily Seed (même seed pour tous, leaderboard séparé) |
| 100 | Mode Custom (choisis tes perks de départ) |

### 7.3 Monnaies

| Monnaie | Source | Usage |
|---|---|---|
| **Coins** (¢) | Runs, daily, duels | Shop run, shop méta |
| **Gems** (💎) | Achievements, records, daily streak | Cosmétiques, classes, boosts |
| **Souls** (👻) | Mort (consolation) | Reliques permanentes, reroll méta |

### 7.4 Cosmétiques (Shop Gems)
- Thèmes de profil (couleurs, banners)
- Titres ("Le Descendu", "Le Fou de l'Étage 30", etc.)
- Emotes d'entrée de run personnalisées
-death messages custom
- Formats d'affichage de stats

---

## 8. ÉCONOMIE ET RÉTENTION

### 8.1 Daily Rewards avec Streak

```
Jour 1: 200 ¢
Jour 2: 250 ¢
Jour 3: 300 ¢
Jour 4: 400 ¢
Jour 5: 500 ¢
Jour 6: 700 ¢
Jour 7: 1000 ¢ + 5 💎 (JACKPOT)

Break streak = retour à Jour 1. Aversion à la perte = rétention.
```

### 8.2 Système de Duels (PvP)

```
/duel @opponent
├─ Les deux joueurs engagent une mise (ex: 500 ¢ chacun)
├─ Combat asymétrique: chacun avec ses perks de classe
├─ Le gagnant prend tout
└─ Taux de taxe: 5% (sink economy)
```

### 8.3 Leaderboards

| Leaderboard | Scope | Reset |
|---|---|---|
| **Profondeur max** | Serveur / Global | Jamais (all-time) |
| **Coins totaux** | Serveur | Jamais |
| **Daily Seed** | Global | Chaque jour |
| **Runs cette semaine** | Serveur | Lundi |
| **Boss kills** | Serveur | Mensuel |

### 8.4 Achievements (50+)

Exemples :
- 🏆 **Premier Sang** : Complète ton premier run
- ⚰️ **Né pour Mourir** : Meurs à l'étage 1
- 🔥 **Pyromane** : Découvre 3 synergies de feu
- 💎 **Le Pacte** : Quitte avec plus de $10,000
- 🎰 **Le Gambler** : Gagne 10 gambles d'affilée
- 👑 **L'Architecte** : Atteins l'étage 25
- 💀 **Le Masochiste** : Joue 10 runs en Hardcore
- 🤝 **Rivalité** : Gagne 5 duels contre la même personne
- 🌟 **Collectionneur** : Débloque toutes les classes
- 🧩 **Maître des Énigmes** : Résous 100 énigmes sans échouer

---

## 9. ÉQUILIBRAGE

### 9.1 Formule de scaling ennemi

```
ennemi_HP = 30 × 1.18^(étage - 1)
ennemi_ATK = 8 × 1.15^(étage - 1)

Exemples:
  Étage 1:  HP 30,  ATK 8
  Étage 5:  HP 57,  ATK 14
  Étage 10: HP 130, ATK 28
  Étage 15: HP 298, ATK 56
  Étage 20: HP 682, ATK 113

Boss = ennemi normal × 2.5 HP, × 1.5 ATK
```

### 9.2 Sinks économiques (éviter l'inflation)
| Sink | Taux |
|---|---|
| Shop en run | Variable (150-500 ¢) |
| Taxe duel | 5% de la mise |
| Reroll perks en run | 200 ¢ |
| Taxe transfert entre joueurs | 10% |
| Mort (perte du pacte) | Variable (gros sink) |
| Cosmétiques | Gems uniquement |

### 9.3 Faucets économiques (sources de monnaie)
| Faucet | Quantité |
|---|---|
| Daily | 200-1000 ¢ |
| Run (quit sécurisé) | 450-40,000+ ¢ |
| Achievement | 100-5000 ¢ |
| Daily Seed reward | 500-5000 ¢ |

**Règle : Faucets ≈ Sinks pour éviter l'inflation.** Ajuster en beta.

---

## 10. COMMANDES DISCORD

### 10.1 Commandes de jeu

| Commande | Description |
|---|---|
| `/descent [classe]` | Commence un run roguelite |
| `/next` | Descend à l'étage suivant |
| `/quit` | Quitte avec le pacte actuel |
| `/status` | Affiche HP, perks, étage, pacte |
| `/attack` | Attaque en combat |
| `/defend` | Défend en combat |
| `/special` | Attaque spéciale de classe |
| `/flee` | Tente de fuir |
| `/use [item]` | Utilise un objet en combat |
| `/shop` | Ouvre le shop en run |
| `/buy [item]` | Achète en shop |

### 10.2 Commandes meta

| Commande | Description |
|---|---|
| `/profile [@user]` | Profil joueur (niveau, stats, records) |
| `/balance` | Solde coins/gems/souls |
| `/daily` | Récompense journalière |
| `/leaderboard [type]` | Classements |
| `/classes` | Liste des classes débloquées |
| `/perks` | Encyclopédie des perks découverts |
| `/synergies` | Synergies découvertes |
| `/achievements` | Liste des achievements |
| `/duel @user [mise]` | Lance un défi PvP |
| `/sharebuild` | Partage ton build actuel |
| `/seed [number]` | Joue un seed spécifique |
| `/dailyseed` | Joue le seed du jour |

### 10.3 Commandes config (admin)

| Commande | Description |
|---|---|
| `/config` | Configuration serveur |
| `/resetcooldown @user` | Reset cooldown (admin) |
| `/givecoins @user amount` | Give coins (admin) |
| `/event [type]` | Lance un event serveur |

---

## 11. AFFICHAGE ET UX DISCORD

### 11.1 Principes
- **Embeds riches** avec couleurs thématiques par type d'étage
- **Boutons interactifs** (discord.js v14) pour les choix (pas que du texte)
- **Emojis** pour lecture rapide et identité visuelle
- **Mises à jour d'embed** en place (pas de spam de messages)

### 11.2 Exemple : début de combat

```
┌─────────────────────────────────────────────┐
│  ⚔️ COMBAT — ÉTAGE 7                        │
│  ──────────────────────────────────────────│
│                                             │
│  🐺 Loup Garou — HP: 45/45                 │
│     ATK: 12 | DEF: 3                       │
│                                             │
│  vs                                         │
│                                             │
│  🧙 Mage — HP: 52/100                      │
│     ATK: 25 | DEF: 3                       │
│     🔥 Perks: Pyromancie, Frappe Rapide    │
│     ⚡ SYNERGIE: "Tempête de Feu"          │
│                                             │
│  ──────────────────────────────────────────│
│  [⚔️ Attaquer] [🛡️ Défendre] [💥 Spécial] │
│  [🏃 Fuir] [🎒 Inventaire]                 │
└─────────────────────────────────────────────┘
```

Tous les choix sont via **boutons** (discord.js v14 Components v2).

---

## 12. MONÉTISATION (Phase 2 — optionnel)

| Feature | Prix | Impact |
|---|---|---|
| **NEXUS Premium** (mensuel) | $3-5/mois | +50% XP, daily x2, cosmétiques exclusifs, /seed illimité |
| **Pack de Gems** | $2-10 | Achat de cosmétiques sans grinder |
| **Battle Pass saisonnier** | $5/saison | Track exclusif 100 niveaux |
| **Cosmétiques à l'unité** | $1-3 | Thèmes, titres, emotes |

**Règle d'or : JAMAIS de pay-to-win.** Tout est cosmétique ou confort.

---

## 13. ROADMAP DE DÉVELOPPEMENT

### Phase 1 — MVP (4-6 semaines)
- [x] Scaffold discord.js v14 + TS + Prisma + Docker
- [x] Système économique de base (coins, daily, wallet)
- [x] Commande /descent avec choix de classe
- [x] Moteur roguelite : génération procédurale d'étages
- [x] 4 classes de base
- [x] 20 perks (4 catégories)
- [x] Types d'étages : Combat + Gamble + Énigme
- [x] Mécanique Quit or Continue
- [x] Leaderboards basiques
- [x] /profile, /balance, /daily

### Phase 2 — Profondeur (4-6 semaines)
- [x] 60 perks complets + synergies
- [x] Tous les types d'étages (Shop, Dilemme, Boss)
- [x] 10 classes (dont 6 débloquables)
- [x] Métaprogression (niveaux, déblocages)
- [x] 50+ Achievements
- [x] Daily Seed
- [x] Duels PvP
- [x] Boutons interactifs v14

### Phase 3 — Rétention virale (4 semaines)
- [x] Saisons + Battle Pass
- [x] Cosmétiques
- [x] Events serveur
- [x] /sharebuild (génère image du build)
- [x] Système de réputation
- [x] Leaderboards globaux

### Phase 4 — Innovation (ongoing)
- [ ] Mode Hardcore
- [ ] Mode Co-op (2 joueurs descendent ensemble)
- [ ] PNJ IA (marchands qui négocient via LLM)
- [ ] ARG / mystères cachés
- [ ] Tournois
- [ ] Custom mode

---

## 14. STACK TECHNIQUE

| Composant | Choix | Raison |
|---|---|---|
| **Framework** | discord.js v14 | Standard, boutons/selects natifs, slash commands |
| **Langage** | TypeScript 5 | Type safety critique pour système complexe |
| **DB** | PostgreSQL 16 | Transactions ACID pour économie fiable |
| **ORM** | Prisma 6 | Migrations, type safety, DX excellent |
| **Cache** | Redis 7 | Cooldowns, rate limiting, active runs en mémoire |
| **Container** | Docker + Docker Compose | Déploiement trivial, iso |
| **Hosting** | Coolify / Hetzner | Infra existante de Jean-Nicolas |
| **Monitoring** | optionnel | Logs structurés (pino) |

---

## 15. ARCHITECTURE DE DONNÉES (Prisma Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// === JOUEUR ===
model User {
  id            String      @id // Discord user ID
  username      String
  level         Int         @default(1)
  xp            Int         @default(0)
  coins         BigInt      @default(1000)
  gems          Int         @default(0)
  souls         Int         @default(0)
  dailyStreak   Int         @default(0)
  lastDaily     DateTime?
  deepestFloor  Int         @default(0)
  totalRuns     Int         @default(0)
  totalKills    Int         @default(0)
  totalBossKills Int        @default(0)
  unlockedClasses String[]  @default(["warrior", "mage", "gambler", "rogue"])
  unlockedPerks  String[]   @default([])
  discoveredSynergies String[] @default([])
  achievements  Json        @default("{}")
  cosmetics     Json        @default("{}")
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  runs          Run[]
  duels         Duel[]      @relation("challenger")
  duelsOpponent Duel[]      @relation("opponent")
  inventory     Inventory[]
  transactions  Transaction[]
}

// === RUN ACTIF/HISTORIQUE ===
model Run {
  id            String      @id @default(uuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  seed          Int
  className     String
  currentFloor  Int         @default(0)
  hp            Int         @default(100)
  maxHp         Int         @default(100)
  atk           Int         @default(15)
  def           Int         @default(5)
  energy        Int         @default(3)
  maxEnergy     Int         @default(3)
  perks         Json        @default("[]") // [{id, name, ...}]
  synergies     Json        @default("[]")
  pactAmount    BigInt      @default(0)
  coinsInRun    Int         @default(0)
  status        RunStatus   @default(ACTIVE)
  isHardcore    Boolean     @default(false)
  isDailySeed   Boolean     @default(false)
  floorHistory  Json        @default("[]")
  startedAt     DateTime    @default(now())
  endedAt       DateTime?
  
  @@index([userId])
  @@index([status])
}

enum RunStatus {
  ACTIVE
  COMPLETED_QUIT
  COMPLETED_DEAD
  ABANDONED
}

// === INVENTAIRE MÉTA ===
model Inventory {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  itemId    String
  quantity  Int      @default(1)
  acquiredAt DateTime @default(now())
  
  @@unique([userId, itemId])
}

// === DUELS ===
model Duel {
  id           String   @id @default(uuid())
  challengerId String
  opponentId   String
  challenger   User     @relation("challenger", fields: [challengerId], references: [id])
  opponent     User     @relation("opponent", fields: [opponentId], references: [id])
  wager        BigInt
  winnerId     String?
  status       String   @default("pending") // pending, accepted, completed, declined
  createdAt    DateTime @default(now())
  resolvedAt   DateTime?
}

// === TRANSACTIONS (audit économique) ===
model Transaction {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // daily, run_win, run_loss, duel, shop, admin, achievement
  amount    BigInt   // positif = gain, négatif = perte
  meta      Json     @default("{}")
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([createdAt])
}

// === CONFIG SERVEUR ===
model Guild {
  id              String   @id
  prefix          String   @default("/")
  language        String   @default("fr")
  enabledChannels String[] @default([])
  bonusMultiplier Float    @default(1.0)
  createdAt       DateTime @default(now())
}

// === LEADERBOARD (materialized pour perf) ===
model LeaderboardEntry {
  userId       String   @id
  username     String
  guildId      String?
  deepestFloor Int
  totalCoins   BigInt
  totalKills   Int
  weeklyRuns   Int
  monthlyBossKills Int
  updatedAt    DateTime @updatedAt
}
```

---

## 16. IDENTITÉ VISUELLE

### Palette de couleurs (embeds)
```
🏠 Meta/Hub:     #2D1B4E (violet profond)
⚔️ Combat:       #E63946 (rouge sang)
🔥 Gamble:       #FFB627 (or)
🧩 Énigme:       #06D6A0 (vert émeraude)
🎭 Dilemme:      #9B59B6 (violet mystère)
🏪 Shop:         #F39C12 (orange commerce)
💀 Mort:         #1A1A2E (noir + rouge)
✅ Victoire:     #00D9A3 (vert triomphe)
```

---

## 17. RISQUES ET MITIGATIONS

| Risque | Mitigation |
|---|---|
| **Déséquilibrage perks** | Beta test + analytics sur win rates |
| **Inflation économique** | Sinks agressifs + monitoring |
| **Abandon des joueurs** | Daily streaks + nouveautés saisonnières |
| **Limites API Discord** | Rate limiting Redis + cache |
| **Runs simultanées** | 1 run actif par joueur max |
| **Scalabilité DB** | Index Prisma + connection pooling |

---

*Document vivant — v1.0 — À itérer avec les retours de Jean-Nicolas*
