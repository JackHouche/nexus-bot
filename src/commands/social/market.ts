import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { browseMarket, createListing, buyListing, cancelListing } from '../../social/market.js';
import { prisma } from '../../database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('🏪 Marché entre joueurs — achète et vends du gear')
    .addSubcommand((sub) => sub.setName('browse').setDescription('Voir les annonces').addStringOption((o) => o.setName('rareté').setDescription('Filtrer par rareté').setRequired(false).addChoices(
      { name: '⚪ Commun', value: 'common' }, { name: '🔵 Rare', value: 'rare' }, { name: '🟣 Épique', value: 'epic' }, { name: '🟡 Légendaire', value: 'legendary' }, { name: '🔴 Mythique', value: 'mythic' }
    )))
    .addSubcommand((sub) => sub.setName('sell').setDescription('Vendre un gear').addStringOption((o) => o.setName('gear_id').setDescription('ID du gear à vendre').setRequired(true)).addIntegerOption((o) => o.setName('prix').setDescription('Prix en coins').setRequired(true).setMinValue(1)))
    .addSubcommand((sub) => sub.setName('buy').setDescription('Acheter une annonce').addStringOption((o) => o.setName('listing_id').setDescription('ID de l\'annonce').setRequired(true)))
    .addSubcommand((sub) => sub.setName('cancel').setDescription('Annuler une annonce').addStringOption((o) => o.setName('listing_id').setDescription('ID de l\'annonce').setRequired(true))) as SlashCommandBuilder,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'browse') {
      const rarity = interaction.options.getString('rareté') ?? undefined;
      const result = await browseMarket(1, rarity ?? undefined);

      if (result.listings.length === 0) {
        return interaction.reply({ content: '🏪 Aucune annonce active pour le moment.', ephemeral: true });
      }

      const rarityEmoji: Record<string, string> = { common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '🔴' };

      const embed = new EmbedBuilder()
        .setTitle('🏪 Marché — Annonces actives')
        .setColor(0xf39c12)
        .setDescription(`${result.total} annonces au total`);

      const lines = result.listings.slice(0, 10).map((l) => {
        return `${rarityEmoji[l.rarity] ?? '⚪'} **${l.name}** — ${l.price.toString()} ¢\n   ID: \`${l.id.slice(0, 8)}\` | Vendeur: ${l.sellerUsername}`;
      }).join('\n\n');

      embed.addFields({ name: 'Annonces', value: lines, inline: false });
      embed.setFooter({ text: 'Utilise /market buy <id> pour acheter' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'sell') {
      const gearId = interaction.options.getString('gear_id')!;
      const price = BigInt(interaction.options.getInteger('prix')!);

      const gear = await prisma.gear.findFirst({ where: { id: gearId, ownerId: userId } });
      if (!gear) {
        return interaction.reply({ content: '❌ Gear introuvable ou ne t\'appartient pas.', ephemeral: true });
      }
      if (gear.equipped) {
        return interaction.reply({ content: '❌ Déséquipe ce gear avant de le vendre.', ephemeral: true });
      }

      const listing = await createListing(userId, gearId, price);

      const embed = new EmbedBuilder()
        .setTitle('🏪 Annonce créée !')
        .setColor(0x00d9a3)
        .setDescription(`Tu vends ${gear.emoji} **${gear.name}** pour ${price.toString()} ¢\nID: \`${listing.id}\``)
        .setFooter({ text: 'L\'annonce reste active jusqu\'à vente ou annulation' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'buy') {
      const listingId = interaction.options.getString('listing_id')!;
      try {
        const result = await buyListing(userId, listingId);
        const embed = new EmbedBuilder()
          .setTitle('🏪 Achat effectué !')
          .setColor(0x00d9a3)
          .setDescription(`Tu as acheté **${result.listing.name}** pour ${result.price.toString()} ¢`)
          .setFooter({ text: 'Taxe de 10% prélevée. Le gear est dans ton inventaire.' });
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({ content: `❌ ${(err as Error).message}`, ephemeral: true });
      }
    }

    if (sub === 'cancel') {
      const listingId = interaction.options.getString('listing_id')!;
      try {
        await cancelListing(userId, listingId);
        return interaction.reply({ content: '✅ Annonce annulée. Le gear est retourné à ton inventaire.', ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `❌ ${(err as Error).message}`, ephemeral: true });
      }
    }
  },
} as SlashCommand;
