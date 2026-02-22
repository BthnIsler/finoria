// ============================================
// Wealth Tracker - Price API Integration
// ============================================

import { PriceData } from './types';

// Cache for price data (60 second TTL)
const priceCache: Record<string, { data: PriceData; timestamp: number }> = {};
const CACHE_TTL = 25_000; // 25 seconds (fits 30s refresh cycle)

function isCacheValid(key: string): boolean {
    const cached = priceCache[key];
    return !!cached && Date.now() - cached.timestamp < CACHE_TTL;
}

// -----------------------------------------------
// CoinGecko API - Kripto para fiyatları
// -----------------------------------------------
export async function fetchCryptoPrices(
    ids: string[]
): Promise<Record<string, PriceData>> {
    if (ids.length === 0) return {};

    // Check cache first
    const uncachedIds = ids.filter((id) => !isCacheValid(`crypto_${id}`));
    const results: Record<string, PriceData> = {};

    // Return cached data
    for (const id of ids) {
        if (isCacheValid(`crypto_${id}`)) {
            results[id] = priceCache[`crypto_${id}`].data;
        }
    }

    if (uncachedIds.length === 0) return results;

    try {
        const idsParam = uncachedIds.join(',');
        const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=try&include_24hr_change=true`,
            { next: { revalidate: 60 } }
        );

        if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
        const data = await res.json();

        for (const id of uncachedIds) {
            if (data[id]) {
                const priceData: PriceData = {
                    price: data[id].try,
                    currency: 'TRY',
                    change24h: data[id].try_24h_change,
                    lastUpdated: new Date().toISOString(),
                };
                results[id] = priceData;
                priceCache[`crypto_${id}`] = { data: priceData, timestamp: Date.now() };
            }
        }
    } catch (error) {
        console.error('Kripto fiyatları alınamadı:', error);
    }

    return results;
}

// -----------------------------------------------
// Exchange Rate API - Döviz kurları
// -----------------------------------------------
export async function fetchForexRates(
    currencies: string[]
): Promise<Record<string, PriceData>> {
    if (currencies.length === 0) return {};

    const results: Record<string, PriceData> = {};
    const uncached = currencies.filter((c) => !isCacheValid(`forex_${c}`));

    for (const c of currencies) {
        if (isCacheValid(`forex_${c}`)) {
            results[c] = priceCache[`forex_${c}`].data;
        }
    }

    if (uncached.length === 0) return results;

    try {
        const res = await fetch(
            `https://api.exchangerate-api.com/v4/latest/TRY`
        );

        if (!res.ok) throw new Error(`ExchangeRate API error: ${res.status}`);
        const data = await res.json();

        for (const currency of uncached) {
            if (data.rates && data.rates[currency]) {
                // API gives TRY to X rate, we need X to TRY (invert)
                const rate = 1 / data.rates[currency];
                const priceData: PriceData = {
                    price: rate,
                    currency: 'TRY',
                    lastUpdated: new Date().toISOString(),
                };
                results[currency] = priceData;
                priceCache[`forex_${currency}`] = { data: priceData, timestamp: Date.now() };
            }
        }
    } catch (error) {
        console.error('Döviz kurları alınamadı:', error);
    }

    return results;
}

// -----------------------------------------------
// Gold Price (via exchange rate + global gold price)
// -----------------------------------------------
export async function fetchGoldPrice(): Promise<PriceData | null> {
    if (isCacheValid('gold_gram')) {
        return priceCache['gold_gram'].data;
    }

    try {
        // Primary: CoinGecko tether-gold (free, no key needed)
        const res = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=try'
        );
        if (res.ok) {
            const data = await res.json();
            if (data['tether-gold']?.try) {
                // XAUT is roughly 1 troy ounce of gold
                const gramPrice = data['tether-gold'].try / 31.1035;
                const priceData: PriceData = {
                    price: gramPrice,
                    currency: 'TRY',
                    lastUpdated: new Date().toISOString(),
                };
                priceCache['gold_gram'] = { data: priceData, timestamp: Date.now() };
                return priceData;
            }
        }

        // Fallback: MetalPriceAPI
        const fallbackRes = await fetch(
            'https://api.metalpriceapi.com/v1/latest?api_key=demo&base=XAU&currencies=TRY'
        );

        if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (fallbackData.rates && fallbackData.rates.TRY) {
                // XAU is per troy ounce, convert to gram (1 troy oz = 31.1035 grams)
                const gramPrice = fallbackData.rates.TRY / 31.1035;
                const priceData: PriceData = {
                    price: gramPrice,
                    currency: 'TRY',
                    lastUpdated: new Date().toISOString(),
                };
                priceCache['gold_gram'] = { data: priceData, timestamp: Date.now() };
                return priceData;
            }
        }
    } catch (error) {
        console.error('Altın fiyatı alınamadı:', error);
    }

    return null;
}

// -----------------------------------------------
// Stock Prices (via our API route)
// -----------------------------------------------
export async function fetchStockPrices(
    symbols: string[]
): Promise<Record<string, PriceData>> {
    if (symbols.length === 0) return {};

    const results: Record<string, PriceData> = {};
    const uncached = symbols.filter((s) => !isCacheValid(`stock_${s}`));

    for (const s of symbols) {
        if (isCacheValid(`stock_${s}`)) {
            results[s] = priceCache[`stock_${s}`].data;
        }
    }

    if (uncached.length === 0) return results;

    try {
        const res = await fetch(`/api/stock-price?symbols=${encodeURIComponent(uncached.join(','))}`);
        if (!res.ok) throw new Error(`Stock API error: ${res.status}`);
        const data = await res.json();

        for (const symbol of uncached) {
            if (data.prices?.[symbol]) {
                const priceData: PriceData = {
                    price: data.prices[symbol].price,
                    currency: 'TRY',
                    change24h: data.prices[symbol].change,
                    lastUpdated: new Date().toISOString(),
                };
                results[symbol] = priceData;
                priceCache[`stock_${symbol}`] = { data: priceData, timestamp: Date.now() };
            }
        }
    } catch (error) {
        console.error('Hisse fiyatları alınamadı:', error);
    }

    return results;
}

// -----------------------------------------------
// Precious Metal Prices (via stock-price API using Yahoo Finance symbols)
// -----------------------------------------------
export async function fetchMetalPrices(
    metalIds: string[]
): Promise<Record<string, PriceData>> {
    if (metalIds.length === 0) return {};

    const results: Record<string, PriceData> = {};

    // Map metal IDs to Yahoo Finance symbols
    const metalMap: Record<string, string> = {
        silver: 'SI=F',
        platinum: 'PL=F',
        palladium: 'PA=F',
    };

    // Check cache
    const uncached = metalIds.filter((id) => !isCacheValid(`metal_${id}`));
    for (const id of metalIds) {
        if (isCacheValid(`metal_${id}`)) {
            results[`metal_${id}`] = priceCache[`metal_${id}`].data;
        }
    }
    if (uncached.length === 0) return results;

    // Fetch prices via stock-price endpoint (same Yahoo Finance route)
    const symbols = uncached.map((id) => metalMap[id]).filter(Boolean);
    if (symbols.length === 0) return results;

    try {
        const res = await fetch(`/api/stock-price?symbols=${encodeURIComponent(symbols.join(','))}`);
        if (!res.ok) return results;
        const data = await res.json();

        // Get USD->TRY rate for conversion (metals are priced in USD)
        const usdRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        let usdToTry = 34; // fallback
        if (usdRes.ok) {
            const usdData = await usdRes.json();
            if (usdData.rates?.TRY) usdToTry = usdData.rates.TRY;
        }

        for (const id of uncached) {
            const symbol = metalMap[id];
            if (symbol && data.prices?.[symbol]) {
                // Convert from USD per troy ounce to TRY per gram
                const usdPerOz = data.prices[symbol].price;
                const tryPerGram = (usdPerOz * usdToTry) / 31.1035;
                const priceData: PriceData = {
                    price: tryPerGram,
                    currency: 'TRY',
                    lastUpdated: new Date().toISOString(),
                };
                results[`metal_${id}`] = priceData;
                priceCache[`metal_${id}`] = { data: priceData, timestamp: Date.now() };
            }
        }
    } catch (error) {
        console.error('Değerli maden fiyatları alınamadı:', error);
    }

    return results;
}

// -----------------------------------------------
// Fetch all prices for a set of assets
// -----------------------------------------------
export async function fetchAllPrices(assets: {
    cryptoIds: string[];
    forexCurrencies: string[];
    stockSymbols: string[];
    metalIds: string[];
    hasGold: boolean;
}): Promise<Record<string, number>> {
    const priceMap: Record<string, number> = {};

    const [cryptoPrices, forexRates, stockPrices, metalPrices, goldPrice] = await Promise.all([
        fetchCryptoPrices(assets.cryptoIds),
        fetchForexRates(assets.forexCurrencies),
        fetchStockPrices(assets.stockSymbols),
        fetchMetalPrices(assets.metalIds),
        assets.hasGold ? fetchGoldPrice() : Promise.resolve(null),
    ]);

    // Crypto
    for (const [id, data] of Object.entries(cryptoPrices)) {
        priceMap[id] = data.price;
    }

    // Forex
    for (const [currency, data] of Object.entries(forexRates)) {
        priceMap[currency] = data.price;
    }

    // Stocks
    for (const [symbol, data] of Object.entries(stockPrices)) {
        priceMap[symbol] = data.price;
    }

    // Precious Metals
    for (const [id, data] of Object.entries(metalPrices)) {
        priceMap[id] = data.price;
    }

    // Gold
    if (goldPrice) {
        priceMap['gold_gram'] = goldPrice.price;
    }

    return priceMap;
}
