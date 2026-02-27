// ============================================
// Wealth Tracker - LocalStorage Operations
// ============================================

import { Asset } from './types';

const STORAGE_KEY = 'wealth_tracker_assets';
const HISTORY_KEY = 'wealth_tracker_history';
const TRANSACTIONS_KEY = 'wealth_tracker_transactions';

// ---- Assets ----

export function getAssets(): Asset[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveAssets(assets: Asset[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
}

export function addAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Asset {
    const assets = getAssets();
    const newAsset: Asset = {
        ...asset,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    assets.push(newAsset);
    saveAssets(assets);
    return newAsset;
}

export function updateAsset(id: string, updates: Partial<Asset>): Asset | null {
    const assets = getAssets();
    const index = assets.findIndex((a) => a.id === id);
    if (index === -1) return null;
    assets[index] = {
        ...assets[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    saveAssets(assets);
    return assets[index];
}

export function deleteAsset(id: string): boolean {
    const assets = getAssets();
    const filtered = assets.filter((a) => a.id !== id);
    if (filtered.length === assets.length) return false;
    saveAssets(filtered);
    return true;
}

export function updateAssetPrices(priceMap: Record<string, number>): Asset[] {
    const assets = getAssets();
    let changed = false;
    for (const asset of assets) {
        if (asset.apiId && priceMap[asset.apiId] !== undefined) {
            asset.currentPrice = priceMap[asset.apiId];
            asset.updatedAt = new Date().toISOString();
            changed = true;
        }
    }
    if (changed) saveAssets(assets);
    return assets;
}

// ---- Wealth History (daily snapshots) ----

export interface WealthSnapshot {
    date: string;   // YYYY-MM-DD
    total: number;
    breakdown: Record<string, number>; // category -> value
}

export function getWealthHistory(): WealthSnapshot[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveWealthSnapshot(assets: Asset[]): void {
    if (typeof window === 'undefined') return;
    const today = new Date().toISOString().split('T')[0];
    const history = getWealthHistory();

    // Calculate totals
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const a of assets) {
        const price = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
        const value = a.amount * price;
        total += value;
        breakdown[a.category] = (breakdown[a.category] || 0) + value;
    }

    // Check if today already has a snapshot — update it
    const existingIdx = history.findIndex((h) => h.date === today);
    if (existingIdx >= 0) {
        history[existingIdx] = { date: today, total, breakdown };
    } else {
        history.push({ date: today, total, breakdown });
    }

    // Keep last 365 days
    const trimmed = history.slice(-365);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));

    // Also save hourly
    saveHourlySnapshot(total, breakdown, assets);
}

// ---- Hourly Snapshots (for 4h/weekly detailed views) ----
const HOURLY_KEY = 'wealth_tracker_hourly';

export interface HourlySnapshot {
    timestamp: string; // ISO string
    total: number;
    high: number;
    low: number;
    open: number;
    close: number;
}

export function getHourlyHistory(): HourlySnapshot[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(HOURLY_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveHourlySnapshot(total: number, _breakdown: Record<string, number>, assets: Asset[]): void {
    if (typeof window === 'undefined') return;
    const now = new Date();
    const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const history = getHourlyHistory();

    const lastIdx = history.findIndex((h) => h.timestamp.startsWith(hourKey));
    if (lastIdx >= 0) {
        // Update existing hourly entry
        const entry = history[lastIdx];
        entry.close = total;
        entry.high = Math.max(entry.high, total);
        entry.low = Math.min(entry.low, total);
    } else {
        history.push({
            timestamp: now.toISOString(),
            total,
            open: total,
            close: total,
            high: total,
            low: total,
        });
    }

    // Keep last 720 entries (~30 days of hourly)
    const trimmed = history.slice(-720);
    localStorage.setItem(HOURLY_KEY, JSON.stringify(trimmed));
}

// ---- Transactions (sell/withdraw log) ----

export interface Transaction {
    id: string;
    assetId: string;
    assetName: string;
    category: string;
    type: 'sell';
    amount: number;
    pricePerUnit: number;
    totalValue: number;
    date: string;
    createdAt: string;
}

export function getTransactions(): Transaction[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(TRANSACTIONS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const transactions = getTransactions();
    const newTx: Transaction = {
        ...tx,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    transactions.push(newTx);
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    return newTx;
}

// Sell part of an asset: deduct amount, log transaction
export function sellAsset(
    assetId: string,
    sellAmount: number,
    sellPricePerUnit: number
): { updatedAsset: Asset | null; transaction: Transaction | null } {
    const assets = getAssets();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return { updatedAsset: null, transaction: null };

    const actualSell = Math.min(sellAmount, asset.amount);
    if (actualSell <= 0) return { updatedAsset: null, transaction: null };

    // Log transaction
    const tx = addTransaction({
        assetId: asset.id,
        assetName: asset.name,
        category: asset.category,
        type: 'sell',
        amount: actualSell,
        pricePerUnit: sellPricePerUnit,
        totalValue: actualSell * sellPricePerUnit,
        date: new Date().toISOString(),
    });

    // Deduct from asset
    asset.amount -= actualSell;
    asset.updatedAt = new Date().toISOString();

    if (asset.amount <= 0.0001) {
        // Remove asset if fully sold
        const filtered = assets.filter((a) => a.id !== assetId);
        saveAssets(filtered);
        return { updatedAsset: null, transaction: tx };
    } else {
        saveAssets(assets);
        return { updatedAsset: asset, transaction: tx };
    }
}

// ---- Per-Asset Price History (for period-based P/L) ----
const ASSET_PRICE_KEY = 'wealth_tracker_asset_prices';

export interface AssetPricePoint {
    timestamp: string;  // ISO date string
    price: number;      // Price per unit at that time
    value: number;      // Total value (amount * price)
}

export function getAssetPriceHistory(assetId: string): AssetPricePoint[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(`${ASSET_PRICE_KEY}_${assetId}`);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveAssetPriceSnapshot(assets: Asset[]): void {
    if (typeof window === 'undefined') return;
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD

    for (const asset of assets) {
        const price = asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice;
        const value = asset.amount * price;
        const history = getAssetPriceHistory(asset.id);

        // Check if today already has an entry — update it
        const existingIdx = history.findIndex(h => h.timestamp.startsWith(dateKey));
        if (existingIdx >= 0) {
            history[existingIdx] = { timestamp: now.toISOString(), price, value };
        } else {
            history.push({ timestamp: now.toISOString(), price, value });
        }

        // Keep last 365 entries
        const trimmed = history.slice(-365);
        localStorage.setItem(`${ASSET_PRICE_KEY}_${asset.id}`, JSON.stringify(trimmed));
    }
}

/**
 * Get the price of an asset at a specific past date.
 * Returns the closest price point at or before the given date.
 */
export function getAssetPriceAtDate(assetId: string, targetDate: Date): number | null {
    const history = getAssetPriceHistory(assetId);
    if (history.length === 0) return null;

    const targetTime = targetDate.getTime();
    let closest: AssetPricePoint | null = null;

    for (const point of history) {
        const pointTime = new Date(point.timestamp).getTime();
        if (pointTime <= targetTime) {
            closest = point;
        }
    }

    return closest?.price ?? null;
}
