// ============================================
// Wealth Tracker - Type Definitions
// ============================================

export type AssetCategory =
    | 'gold'
    | 'precious_metals'
    | 'crypto'
    | 'forex'
    | 'stock'
    | 'real_estate'
    | 'savings'
    | 'other';

export interface Asset {
    id: string;
    name: string;
    category: AssetCategory;
    amount: number;
    purchasePrice: number;        // Alış fiyatı (birim başı)
    purchaseCurrency: string;     // Alış para birimi
    currentPrice?: number;        // Güncel fiyat (otomatik güncellenir)
    manualCurrentPrice?: number;  // Manuel güncel fiyat (API yoksa)
    apiId?: string;               // API'den fiyat çekmek için id (ör: "bitcoin")
    createdAt: string;
    updatedAt: string;
}

export interface PriceData {
    price: number;
    currency: string;
    change24h?: number;
    lastUpdated: string;
}

export interface CategoryMeta {
    key: AssetCategory;
    label: string;
    labelTR: string;
    icon: string;
    color: string;
    gradient: string;
}

export const CATEGORIES: CategoryMeta[] = [
    {
        key: 'gold',
        label: 'Gold',
        labelTR: 'Altın',
        icon: '🪙',
        color: '#F59E0B',
        gradient: 'from-yellow-500 to-amber-600',
    },
    {
        key: 'precious_metals',
        label: 'Precious Metals',
        labelTR: 'Değerli Maden',
        icon: '💎',
        color: '#94A3B8',
        gradient: 'from-slate-400 to-zinc-500',
    },
    {
        key: 'crypto',
        label: 'Crypto',
        labelTR: 'Kripto',
        icon: '₿',
        color: '#8B5CF6',
        gradient: 'from-violet-500 to-purple-600',
    },
    {
        key: 'forex',
        label: 'Forex',
        labelTR: 'Döviz',
        icon: '💱',
        color: '#10B981',
        gradient: 'from-emerald-500 to-green-600',
    },
    {
        key: 'stock',
        label: 'Stock',
        labelTR: 'Hisse Senedi',
        icon: '📈',
        color: '#3B82F6',
        gradient: 'from-blue-500 to-indigo-600',
    },
    {
        key: 'real_estate',
        label: 'Real Estate',
        labelTR: 'Gayrimenkul',
        icon: '🏠',
        color: '#EC4899',
        gradient: 'from-pink-500 to-rose-600',
    },
    {
        key: 'savings',
        label: 'Savings',
        labelTR: 'Birikim',
        icon: '💰',
        color: '#06B6D4',
        gradient: 'from-cyan-500 to-teal-600',
    },
    {
        key: 'other',
        label: 'Other',
        labelTR: 'Diğer',
        icon: '📦',
        color: '#6B7280',
        gradient: 'from-gray-500 to-slate-600',
    },
];

export function getCategoryMeta(key: AssetCategory): CategoryMeta {
    return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

// Popüler kripto listesi
export const POPULAR_CRYPTOS = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
    { id: 'solana', name: 'Solana', symbol: 'SOL' },
    { id: 'ripple', name: 'XRP', symbol: 'XRP' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
    { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
    { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' },
    { id: 'tron', name: 'TRON', symbol: 'TRX' },
];

// Popüler döviz listesi
export const POPULAR_FOREX = [
    { id: 'USD', name: 'Amerikan Doları', symbol: '$' },
    { id: 'EUR', name: 'Euro', symbol: '€' },
    { id: 'GBP', name: 'İngiliz Sterlini', symbol: '£' },
    { id: 'CHF', name: 'İsviçre Frangı', symbol: 'CHF' },
    { id: 'JPY', name: 'Japon Yeni', symbol: '¥' },
];

// Altın çeşitleri (gram cinsinden ağırlıkları)
export const GOLD_TYPES = [
    { id: 'gram', name: 'Gram Altın', grams: 1 },
    { id: 'ceyrek', name: 'Çeyrek Altın', grams: 1.75 },
    { id: 'yarim', name: 'Yarım Altın', grams: 3.5 },
    { id: 'tam', name: 'Tam Altın', grams: 7.0 },
    { id: 'cumhuriyet', name: 'Cumhuriyet Altını', grams: 7.216 },
    { id: 'ata', name: 'Ata Altın', grams: 7.216 },
    { id: 'resat', name: 'Reşat Altın', grams: 7.216 },
    { id: 'hamit', name: 'Hamit Altın', grams: 7.216 },
    { id: '22ayar', name: '22 Ayar Bilezik (gr)', grams: 1 },
    { id: '18ayar', name: '18 Ayar (gr)', grams: 1 },
    { id: '14ayar', name: '14 Ayar (gr)', grams: 1 },
];

// Değerli madenler
export interface PreciousMetalType {
    id: string;
    name: string;
    apiSymbol: string; // Yahoo Finance symbol
    unit: string;
}

export const PRECIOUS_METALS: PreciousMetalType[] = [
    { id: 'silver', name: 'Gümüş (gram)', apiSymbol: 'SI=F', unit: 'gram' },
    { id: 'platinum', name: 'Platin (gram)', apiSymbol: 'PL=F', unit: 'gram' },
    { id: 'palladium', name: 'Paladyum (gram)', apiSymbol: 'PA=F', unit: 'gram' },
    { id: 'rhodium', name: 'Rodyum (gram)', apiSymbol: 'RHOD', unit: 'gram' },
];
