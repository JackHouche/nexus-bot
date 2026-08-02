/**
 * Player-to-player marketplace — players list gear or items for sale, others
 * browse and buy. Each sale is taxed (10% market fee) and fully audited via
 * Transaction records.
 */

import { prisma } from '../database.js';
import { logger } from '../logger.js';

/** Market tax rate applied to the seller's proceeds (10%). */
export const MARKET_TAX_RATE = 0.10;

/** Page size for browseMarket. */
export const MARKET_PAGE_SIZE = 10;

/** Minimum listing price. */
export const MIN_PRICE = 1n;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface MarketListingRecord {
  id: string;
  sellerId: string;
  sellerUsername: string;
  gearId: string | null;
  itemId: string | null;
  name: string;
  emoji: string;
  rarity: string;
  price: bigint;
  sold: boolean;
  buyerId: string | null;
  soldAt: Date | null;
  createdAt: Date;
}

export interface BrowseResult {
  listings: MarketListingRecord[];
  page: number;
  totalPages: number;
  total: number;
}

export interface BuyResult {
  listing: MarketListingRecord;
  price: bigint;
  /** Tax deducted from the seller's proceeds. */
  tax: bigint;
  /** Net coins the seller received. */
  sellerProceeds: bigint;
}

export interface MarketHistoryEntry {
  name: string;
  emoji: string;
  rarity: string;
  price: bigint;
  soldAt: Date;
}

/**
 * Create a listing from an existing Gear record.
 * The gear remains owned by the seller until purchased; the UI layer should
 * prevent use of listed gear while the listing is active.
 *
 * @param sellerId Discord user ID of the seller.
 * @param gearId   Gear ID to sell.
 * @param price    Asking price (BigInt).
 */
export async function createListing(
  sellerId: string,
  gearId: string,
  price: bigint
): Promise<MarketListingRecord> {
  const gear = await prisma.gear.findUnique({ where: { id: gearId } });
  if (!gear) throw new Error('Cet équipement n\'existe pas.');
  if (gear.ownerId !== sellerId) {
    throw new Error('Tu ne possèdes pas cet équipement.');
  }

  return createListingInternal(sellerId, price, {
    gearId,
    itemId: gear.itemId,
    name: gear.name,
    emoji: gear.emoji,
    rarity: gear.rarity,
  });
}

/**
 * Create a listing for a raw item (not a Gear record — e.g. a consumable from
 * inventory).
 *
 * @param sellerId  Discord user ID of the seller.
 * @param itemId    Item definition ID.
 * @param itemName  Display name.
 * @param emoji     Item emoji.
 * @param rarity    Item rarity.
 * @param price     Asking price (BigInt).
 */
export async function createListingForItem(
  sellerId: string,
  itemId: string,
  itemName: string,
  emoji: string,
  rarity: string,
  price: bigint
): Promise<MarketListingRecord> {
  return createListingInternal(sellerId, price, {
    gearId: null,
    itemId,
    name: itemName,
    emoji,
    rarity,
  });
}

/**
 * Browse active (unsold) listings, optionally filtered by rarity.
 * Results are paginated, newest first.
 *
 * @param page         1-indexed page number.
 * @param rarityFilter Optional rarity filter.
 */
export async function browseMarket(
  page: number = 1,
  rarityFilter?: string
): Promise<BrowseResult> {
  const where = {
    sold: false,
    ...(rarityFilter ? { rarity: rarityFilter } : {}),
  };

  const total = await prisma.marketListing.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const skip = (safePage - 1) * MARKET_PAGE_SIZE;

  const listings = await prisma.marketListing.findMany({
    where,
    include: { seller: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: MARKET_PAGE_SIZE,
  });

  return {
    listings: listings.map(toRecord),
    page: safePage,
    totalPages,
    total,
  };
}

/**
 * Buy a listing. Performs an atomic transaction:
 *  - checks buyer has enough coins
 *  - deducts coins from buyer
 *  - credits seller (price minus 10% tax)
 *  - marks listing sold
 *  - transfers Gear ownership (if gear-backed listing)
 *  - creates Transaction records for both buyer and seller
 *
 * @param buyerId   Discord user ID of the buyer.
 * @param listingId Listing ID.
 */
export async function buyListing(
  buyerId: string,
  listingId: string
): Promise<BuyResult> {
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) throw new Error('Cette annonce n\'existe pas.');
  if (listing.sold) throw new Error('Cet objet a déjà été vendu.');
  if (listing.sellerId === buyerId) {
    throw new Error('Tu ne peux pas acheter ton propre objet.');
  }

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) throw new Error('Acheteur introuvable.');

  if (buyer.coins < listing.price) {
    throw new Error(
      `Fonds insuffisants. Il te faut ${listing.price.toString()} pièces (tu en as ${buyer.coins.toString()}).`
    );
  }

  const price = BigInt(listing.price);
  const tax = (price * BigInt(Math.round(MARKET_TAX_RATE * 100))) / 100n;
  const sellerProceeds = price - tax;
  const now = new Date();

  // Build the transaction batch.
  const tx = [
    // Deduct buyer coins.
    prisma.user.update({
      where: { id: buyerId },
      data: { coins: { decrement: price } },
    }),
    // Credit seller coins (net of tax).
    prisma.user.update({
      where: { id: listing.sellerId },
      data: { coins: { increment: sellerProceeds } },
    }),
    // Mark listing sold.
    prisma.marketListing.update({
      where: { id: listingId },
      data: {
        sold: true,
        buyerId,
        soldAt: now,
      },
    }),
    // Buyer transaction record.
    prisma.transaction.create({
      data: {
        userId: buyerId,
        type: 'market',
        amount: -price,
        meta: {
          action: 'buy',
          listingId,
          sellerId: listing.sellerId,
          name: listing.name,
          rarity: listing.rarity,
        },
      },
    }),
    // Seller transaction record.
    prisma.transaction.create({
      data: {
        userId: listing.sellerId,
        type: 'market',
        amount: sellerProceeds,
        meta: {
          action: 'sell',
          listingId,
          buyerId,
          name: listing.name,
          rarity: listing.rarity,
          tax: tax.toString(),
          grossPrice: price.toString(),
        },
      },
    }),
  ];

  // Transfer Gear ownership if this is a gear-backed listing.
  if (listing.gearId) {
    tx.push(
      prisma.gear.update({
        where: { id: listing.gearId },
        data: { ownerId: buyerId, equipped: false },
      }) as unknown as typeof tx[number]
    );
  }

  await prisma.$transaction(tx);

  logger.info(
    {
      buyerId,
      sellerId: listing.sellerId,
      listingId,
      price: price.toString(),
      tax: tax.toString(),
    },
    'Market purchase completed'
  );

  const updated = await prisma.marketListing.findUnique({
    where: { id: listingId },
    include: { seller: true },
  });

  return {
    listing: updated ? toRecord(updated) : toRecord({ ...listing, seller: null }),
    price,
    tax,
    sellerProceeds,
  };
}

/**
 * Cancel an active listing. Only the seller can cancel, and only unsold
 * listings can be cancelled.
 *
 * @param sellerId  Discord user ID of the seller.
 * @param listingId Listing ID.
 */
export async function cancelListing(
  sellerId: string,
  listingId: string
): Promise<void> {
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) throw new Error('Cette annonce n\'existe pas.');
  if (listing.sellerId !== sellerId) {
    throw new Error('Tu ne peux pas annuler l\'annonce d\'un autre joueur.');
  }
  if (listing.sold) throw new Error('Cette annonce est déjà vendue.');

  await prisma.marketListing.delete({ where: { id: listingId } });
}

/**
 * Get market history for a specific item — recent sold prices for analytics.
 *
 * @param itemId Item definition ID (matches MarketListing.itemId).
 * @param limit  Maximum number of results (default 20).
 */
export async function getMarketHistory(
  itemId: string,
  limit: number = 20
): Promise<MarketHistoryEntry[]> {
  const sold = await prisma.marketListing.findMany({
    where: { itemId, sold: true },
    orderBy: { soldAt: 'desc' },
    take: limit,
  });

  return sold.map(
    (s: {
      name: string;
      emoji: string;
      rarity: string;
      price: bigint;
      soldAt: Date | null;
      createdAt: Date;
    }) => ({
      name: s.name,
      emoji: s.emoji,
      rarity: s.rarity,
      price: s.price,
      soldAt: s.soldAt ?? s.createdAt,
  }));
}

// ---------------------------------------------------------------------------
//  Internal helpers
// ---------------------------------------------------------------------------

interface CreateListingInput {
  gearId: string | null;
  itemId: string | null;
  name: string;
  emoji: string;
  rarity: string;
}

async function createListingInternal(
  sellerId: string,
  price: bigint,
  input: CreateListingInput
): Promise<MarketListingRecord> {
  if (price < MIN_PRICE) {
    throw new Error(`Le prix minimum est de ${MIN_PRICE.toString()} pièces.`);
  }
  if (input.name.trim().length === 0) {
    throw new Error('Le nom de l\'objet ne peut pas être vide.');
  }

  const listing = await prisma.marketListing.create({
    data: {
      sellerId,
      gearId: input.gearId,
      itemId: input.itemId,
      name: input.name.trim(),
      emoji: input.emoji,
      rarity: input.rarity,
      price: BigInt(price),
    },
    include: { seller: true },
  });

  return toRecord(listing);
}

function toRecord(row: {
  id: string;
  sellerId: string;
  seller: { username: string } | null;
  gearId: string | null;
  itemId: string | null;
  name: string;
  emoji: string;
  rarity: string;
  price: bigint;
  sold: boolean;
  buyerId: string | null;
  soldAt: Date | null;
  createdAt: Date;
}): MarketListingRecord {
  return {
    id: row.id,
    sellerId: row.sellerId,
    sellerUsername: row.seller?.username ?? 'Inconnu',
    gearId: row.gearId,
    itemId: row.itemId,
    name: row.name,
    emoji: row.emoji,
    rarity: row.rarity,
    price: row.price,
    sold: row.sold,
    buyerId: row.buyerId,
    soldAt: row.soldAt,
    createdAt: row.createdAt,
  };
}
