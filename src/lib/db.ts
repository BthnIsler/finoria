import { Asset } from './types';
import { WealthSnapshot } from './storage';

// ── Detect if Supabase is properly configured ─────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const IS_SUPABASE_CONFIGURED =
    SUPABASE_URL.length > 0 &&
    !SUPABASE_URL.includes('dummy') &&
    !SUPABASE_URL.includes('placeholder') &&
    SUPABASE_URL.startsWith('https://');

// ── localStorage keys ─────────────────────────────────────────────────────
const LS_ASSETS_PREFIX = 'finoria_assets_';
const LS_HISTORY_PREFIX = 'finoria_history_';

function getLocalAssets(userId: string): Asset[] {
    try { return JSON.parse(localStorage.getItem(LS_ASSETS_PREFIX + userId) || '[]'); } catch { return []; }
}
function saveLocalAssets(userId: string, assets: Asset[]) {
    localStorage.setItem(LS_ASSETS_PREFIX + userId, JSON.stringify(assets));
}
function getLocalHistory(userId: string): WealthSnapshot[] {
    try { return JSON.parse(localStorage.getItem(LS_HISTORY_PREFIX + userId) || '[]'); } catch { return []; }
}
function saveLocalHistory(userId: string, history: WealthSnapshot[]) {
    localStorage.setItem(LS_HISTORY_PREFIX + userId, JSON.stringify(history));
}
function genId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Migration helper ──────────────────────────────────────────────────────
export async function migrateLocalDataToSupabase(userId: string) {
    if (!IS_SUPABASE_CONFIGURED) return;
    const { supabase } = await import('./supabase');
    const { getAssets: getLocalAssets2, getWealthHistory: getLocalHistory2 } = await import('./storage');
    const localAssets = getLocalAssets2();
    const localHistory = getLocalHistory2();

    if (localAssets.length > 0) {
        await supabase.from('assets').insert(
            localAssets.map((a) => ({
                user_id: userId, name: a.name, category: a.category, amount: a.amount,
                purchase_price: a.purchasePrice, current_price: a.currentPrice,
                manual_current_price: a.manualCurrentPrice,
            }))
        );
    }
    if (localHistory.length > 0) {
        await supabase.from('wealth_history').insert(
            localHistory.map((h) => ({ user_id: userId, date: h.date, total: h.total, breakdown: h.breakdown }))
        );
    }
    localStorage.removeItem('wealth_tracker_assets');
    localStorage.removeItem('wealth_tracker_history');
}

// ── getAssets ─────────────────────────────────────────────────────────────
export async function getAssets(userId: string): Promise<Asset[]> {
    if (!IS_SUPABASE_CONFIGURED) {
        return getLocalAssets(userId);
    }

    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
        .from('assets').select('*').eq('user_id', userId).order('created_at', { ascending: true });

    if (error || !data) {
        console.error('Error fetching assets:', error);
        // Fallback to local even if configured but failing
        return getLocalAssets(userId);
    }

    return data.map((d: any) => ({
        id: d.id, name: d.name, category: d.category,
        amount: parseFloat(d.amount), purchasePrice: parseFloat(d.purchase_price),
        purchaseCurrency: d.purchase_currency || 'TRY',
        currentPrice: d.current_price ? parseFloat(d.current_price) : undefined,
        manualCurrentPrice: d.manual_current_price ? parseFloat(d.manual_current_price) : undefined,
        apiId: d.api_id, createdAt: d.created_at, updatedAt: d.created_at,
    }));
}

// ── addAsset ──────────────────────────────────────────────────────────────
export async function addAsset(userId: string, asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset | null> {
    if (!IS_SUPABASE_CONFIGURED) {
        // Pure localStorage save
        const assets = getLocalAssets(userId);
        const newAsset: Asset = {
            ...asset,
            id: genId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        assets.push(newAsset);
        saveLocalAssets(userId, assets);
        return newAsset;
    }

    const { supabase } = await import('./supabase');
    const insertData: any = {
        user_id: userId, name: asset.name, category: asset.category,
        amount: asset.amount, purchase_price: asset.purchasePrice,
        current_price: asset.currentPrice, manual_current_price: asset.manualCurrentPrice,
    };
    if (asset.apiId) insertData.api_id = asset.apiId;
    if (asset.purchaseCurrency) insertData.purchase_currency = asset.purchaseCurrency;

    const { data, error } = await supabase.from('assets').insert(insertData).select().single();

    if (error) {
        console.warn('Supabase addAsset failed, saving locally:', error.message);
        // Fallback to local
        const assets = getLocalAssets(userId);
        const newAsset: Asset = {
            ...asset, id: genId(),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        assets.push(newAsset);
        saveLocalAssets(userId, assets);
        return newAsset;
    }

    if (!data) throw new Error('Veri döndürülmedi.');

    return {
        ...asset, id: data.id,
        createdAt: data.created_at, updatedAt: data.created_at,
    };
}

// ── updateAsset ───────────────────────────────────────────────────────────
export async function updateAsset(id: string, updates: Partial<Asset>, userId?: string): Promise<boolean> {
    if (!IS_SUPABASE_CONFIGURED) {
        if (!userId) return false;
        const assets = getLocalAssets(userId);
        const idx = assets.findIndex(a => a.id === id);
        if (idx === -1) return false;
        assets[idx] = { ...assets[idx], ...updates, updatedAt: new Date().toISOString() };
        saveLocalAssets(userId, assets);
        return true;
    }

    const { supabase } = await import('./supabase');
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.purchasePrice !== undefined) payload.purchase_price = updates.purchasePrice;
    if (updates.currentPrice !== undefined) payload.current_price = updates.currentPrice;
    if (updates.manualCurrentPrice !== undefined) payload.manual_current_price = updates.manualCurrentPrice;

    const { error } = await supabase.from('assets').update(payload).eq('id', id);

    if (error) {
        console.warn('Supabase updateAsset failed, updating locally:', error.message);
        if (userId) {
            const assets = getLocalAssets(userId);
            const idx = assets.findIndex(a => a.id === id);
            if (idx !== -1) {
                assets[idx] = { ...assets[idx], ...updates, updatedAt: new Date().toISOString() };
                saveLocalAssets(userId, assets);
            }
        }
    }
    return !error;
}

// ── deleteAsset ───────────────────────────────────────────────────────────
export async function deleteAsset(id: string, userId?: string): Promise<boolean> {
    if (!IS_SUPABASE_CONFIGURED) {
        if (!userId) return false;
        const assets = getLocalAssets(userId).filter(a => a.id !== id);
        saveLocalAssets(userId, assets);
        return true;
    }

    const { supabase } = await import('./supabase');
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error && userId) {
        const assets = getLocalAssets(userId).filter(a => a.id !== id);
        saveLocalAssets(userId, assets);
    }
    return !error;
}

// ── getWealthHistory ──────────────────────────────────────────────────────
export async function getWealthHistory(userId: string): Promise<WealthSnapshot[]> {
    if (!IS_SUPABASE_CONFIGURED) return getLocalHistory(userId);

    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
        .from('wealth_history').select('*').eq('user_id', userId).order('date', { ascending: true });

    if (error || !data) return getLocalHistory(userId);

    return data.map((d: any) => ({
        date: d.date, total: parseFloat(d.total), breakdown: d.breakdown,
    }));
}

// ── saveWealthSnapshot ────────────────────────────────────────────────────
export async function saveWealthSnapshot(userId: string, assets: Asset[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const breakdown: Record<string, number> = {};
    let total = 0;

    for (const a of assets) {
        const price = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
        const value = a.amount * price;
        total += value;
        breakdown[a.category] = (breakdown[a.category] || 0) + value;
    }

    if (!IS_SUPABASE_CONFIGURED) {
        const history = getLocalHistory(userId);
        const idx = history.findIndex(h => h.date === today);
        if (idx >= 0) { history[idx] = { date: today, total, breakdown }; }
        else { history.push({ date: today, total, breakdown }); }
        saveLocalHistory(userId, history);
        return;
    }

    const { supabase } = await import('./supabase');
    const { error } = await supabase.from('wealth_history')
        .upsert({ user_id: userId, date: today, total, breakdown }, { onConflict: 'user_id, date' });

    if (error) {
        console.warn('Supabase snapshot save failed, saving locally:', error.message);
        const history = getLocalHistory(userId);
        const idx = history.findIndex(h => h.date === today);
        if (idx >= 0) { history[idx] = { date: today, total, breakdown }; }
        else { history.push({ date: today, total, breakdown }); }
        saveLocalHistory(userId, history);
    }
}

// ── saveMultipleAssetPrices ───────────────────────────────────────────────
export async function saveMultipleAssetPrices(userId: string, assets: Asset[]): Promise<void> {
    if (!IS_SUPABASE_CONFIGURED) {
        const stored = getLocalAssets(userId);
        const priceMap = new Map(assets.map(a => [a.id, a.currentPrice]));
        const updated = stored.map(a => priceMap.has(a.id) ? { ...a, currentPrice: priceMap.get(a.id) } : a);
        saveLocalAssets(userId, updated);
        return;
    }

    const { supabase } = await import('./supabase');
    for (const a of assets) {
        if (a.currentPrice !== undefined) {
            await supabase.from('assets').update({ current_price: a.currentPrice }).eq('id', a.id).eq('user_id', userId);
        }
    }
}

// ── sellAsset ─────────────────────────────────────────────────────────────
export async function sellAsset(
    userId: string, assetId: string,
    currentAmount: number, sellAmount: number, sellPricePerUnit: number
): Promise<Asset | null> {
    const remaining = currentAmount - sellAmount;

    if (remaining <= 0.0001) {
        await deleteAsset(assetId, userId);
        return null;
    }

    await updateAsset(assetId, { amount: remaining }, userId);

    if (!IS_SUPABASE_CONFIGURED) {
        const assets = getLocalAssets(userId);
        return assets.find(a => a.id === assetId) ?? null;
    }

    const { supabase } = await import('./supabase');
    const { data } = await supabase.from('assets').select('*').eq('id', assetId).single();
    if (!data) return null;

    return {
        id: data.id, name: data.name, category: data.category,
        amount: parseFloat(data.amount), purchasePrice: parseFloat(data.purchase_price),
        purchaseCurrency: data.purchase_currency || 'TRY',
        currentPrice: data.current_price ? parseFloat(data.current_price) : undefined,
        manualCurrentPrice: data.manual_current_price ? parseFloat(data.manual_current_price) : undefined,
        apiId: data.api_id, createdAt: data.created_at, updatedAt: data.created_at,
    } as Asset;
}
