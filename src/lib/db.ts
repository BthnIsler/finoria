import { supabase } from './supabase';
import { Asset } from './types';
import { WealthSnapshot } from './storage'; // Reusing type
import { getAssets as getLocalAssets, getWealthHistory as getLocalHistory } from './storage';

export async function migrateLocalDataToSupabase(userId: string) {
    const localAssets = getLocalAssets();
    const localHistory = getLocalHistory();

    if (localAssets.length > 0) {
        const { error } = await supabase.from('assets').insert(
            localAssets.map((a) => ({
                user_id: userId,
                name: a.name,
                category: a.category,
                amount: a.amount,
                purchase_price: a.purchasePrice,
                current_price: a.currentPrice,
                manual_current_price: a.manualCurrentPrice,
            }))
        );
        if (error) console.error('Asset migration error:', error);
    }

    if (localHistory.length > 0) {
        const { error } = await supabase.from('wealth_history').insert(
            localHistory.map((h) => ({
                user_id: userId,
                date: h.date,
                total: h.total,
                breakdown: h.breakdown,
            }))
        );
        if (error) console.error('History migration error:', error);
    }

    // Clear local storage after successful migration
    localStorage.removeItem('wealth_tracker_assets');
    localStorage.removeItem('wealth_tracker_history');
}

export async function getAssets(userId: string): Promise<Asset[]> {
    const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error || !data) {
        console.error('Error fetching assets:', error);
        return [];
    }

    return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        amount: parseFloat(d.amount),
        purchasePrice: parseFloat(d.purchase_price),
        purchaseCurrency: 'TRY', // Default format
        currentPrice: d.current_price ? parseFloat(d.current_price) : undefined,
        manualCurrentPrice: d.manual_current_price ? parseFloat(d.manual_current_price) : undefined,
        apiId: d.api_id, // We need to add api_id to the schema! Wait, I missed it in the SQL.
        createdAt: d.created_at,
        updatedAt: d.created_at,
    }));
}

export async function addAsset(userId: string, asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset | null> {
    const insertData: any = {
        user_id: userId,
        name: asset.name,
        category: asset.category,
        amount: asset.amount,
        purchase_price: asset.purchasePrice,
        current_price: asset.currentPrice,
        manual_current_price: asset.manualCurrentPrice,
    };

    // Only include optional columns if they have values
    if (asset.apiId) insertData.api_id = asset.apiId;
    if (asset.purchaseCurrency) insertData.purchase_currency = asset.purchaseCurrency;

    const { data, error } = await supabase
        .from('assets')
        .insert(insertData)
        .select()
        .single();

    if (error || !data) {
        console.error('Add asset error:', error);
        return null;
    }

    return {
        ...asset,
        id: data.id,
        createdAt: data.created_at,
        updatedAt: data.created_at,
    };
}

export async function updateAsset(id: string, updates: Partial<Asset>): Promise<boolean> {
    const updatePayload: any = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.amount !== undefined) updatePayload.amount = updates.amount;
    if (updates.purchasePrice !== undefined) updatePayload.purchase_price = updates.purchasePrice;
    if (updates.currentPrice !== undefined) updatePayload.current_price = updates.currentPrice;
    if (updates.manualCurrentPrice !== undefined) updatePayload.manual_current_price = updates.manualCurrentPrice;

    const { error } = await supabase
        .from('assets')
        .update(updatePayload)
        .eq('id', id);

    if (error) {
        console.error('Update asset error:', error);
        return false;
    }
    return true;
}

export async function deleteAsset(id: string): Promise<boolean> {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    return !error;
}

export async function getWealthHistory(userId: string): Promise<WealthSnapshot[]> {
    const { data, error } = await supabase
        .from('wealth_history')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

    if (error || !data) return [];

    return data.map((d: any) => ({
        date: d.date,
        total: parseFloat(d.total),
        breakdown: d.breakdown,
    }));
}

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

    // Upsert snapshot for today
    const { error } = await supabase
        .from('wealth_history')
        .upsert({
            user_id: userId,
            date: today,
            total,
            breakdown
        }, { onConflict: 'user_id, date' });

    if (error) console.error('Snapshot save error:', error);
}

export async function saveMultipleAssetPrices(userId: string, assets: Asset[]): Promise<void> {
    const updates = assets.map(a => ({
        id: a.id,
        current_price: a.currentPrice
    }));

    // Simplest way to batch update in supabase without an RPC is a loop
    for (const u of updates) {
        await supabase.from('assets').update({ current_price: u.current_price }).eq('id', u.id).eq('user_id', userId);
    }
}

export async function sellAsset(
    userId: string,
    assetId: string,
    currentAmount: number,
    sellAmount: number,
    sellPricePerUnit: number
): Promise<Asset | null> {
    const remaining = currentAmount - sellAmount;

    if (remaining <= 0.0001) {
        // Delete asset if fully sold
        await deleteAsset(assetId);
        return null;
    } else {
        // Update asset amount
        await updateAsset(assetId, { amount: remaining });
        // Retrieve updated asset to return
        const { data } = await supabase.from('assets').select('*').eq('id', assetId).single();
        if (!data) return null;

        return {
            id: data.id,
            name: data.name,
            category: data.category,
            amount: parseFloat(data.amount),
            purchasePrice: parseFloat(data.purchase_price),
            purchaseCurrency: 'TRY',
            currentPrice: data.current_price ? parseFloat(data.current_price) : undefined,
            manualCurrentPrice: data.manual_current_price ? parseFloat(data.manual_current_price) : undefined,
            apiId: data.api_id,
            createdAt: data.created_at,
            updatedAt: data.created_at,
        } as Asset;
    }
}
