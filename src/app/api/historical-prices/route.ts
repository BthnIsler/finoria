import { NextRequest, NextResponse } from 'next/server';

// Fetch historical prices for a list of assets.
// Each asset: { apiId, category, amount }
// Returns: { points: { date: string; value: number }[] }

type AssetInput = {
    apiId: string;
    category: string;
    amount: number;
};

type PriceSeries = { date: string; price: number }[];

const RANGE_MAP: Record<string, string> = {
    '3m': '3mo',
    '1y': '1y',
    '3y': '3y',
};

const DAYS_MAP: Record<string, number> = {
    '3m': 90,
    '1y': 365,
    '3y': 1095,
};

// Fetch USD→TRY rate for a specific date range from Yahoo Finance
async function fetchUsdTrySeries(range: string): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=${range}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) return map;
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const timestamps: number[] = result?.timestamp ?? [];
        const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];
        timestamps.forEach((ts, i) => {
            if (closes[i] != null) {
                const date = new Date(ts * 1000).toISOString().split('T')[0];
                map.set(date, closes[i]);
            }
        });
    } catch { /* ignore */ }
    return map;
}

// Fetch historical closing prices for a Yahoo Finance symbol
async function fetchYahooSeries(yahooSymbol: string, range: string): Promise<PriceSeries> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=${range}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const timestamps: number[] = result?.timestamp ?? [];
        const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];
        return timestamps.map((ts, i) => ({
            date: new Date(ts * 1000).toISOString().split('T')[0],
            price: closes[i] ?? 0,
        })).filter(p => p.price > 0);
    } catch {
        return [];
    }
}

// Fetch historical closing prices for a CoinGecko crypto ID (prices in TRY)
async function fetchCoinGeckoSeries(coinId: string, days: number): Promise<PriceSeries> {
    try {
        const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=try&days=${days}&interval=daily`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        const prices: [number, number][] = data?.prices ?? [];
        return prices.map(([ts, price]) => ({
            date: new Date(ts).toISOString().split('T')[0],
            price,
        }));
    } catch {
        return [];
    }
}

export async function POST(request: NextRequest) {
    const { assets, period }: { assets: AssetInput[]; period: string } = await request.json();

    const range = RANGE_MAP[period] ?? '1y';
    const days = DAYS_MAP[period] ?? 365;

    if (!assets || assets.length === 0) {
        return NextResponse.json({ points: [] });
    }

    // Step 1: fetch USD→TRY series (needed for NASDAQ stocks)
    const hasNasdaq = assets.some(a => a.category === 'stock' && !a.apiId.startsWith('BIST:'));
    const usdTryMap = hasNasdaq ? await fetchUsdTrySeries(range) : new Map<string, number>();

    // Step 2: fetch price series for each asset in parallel
    const seriesResults = await Promise.allSettled(assets.map(async (asset) => {
        let series: PriceSeries = [];

        if (asset.category === 'crypto' && asset.apiId) {
            series = await fetchCoinGeckoSeries(asset.apiId, days);
        } else if (asset.category === 'stock' && asset.apiId) {
            const isBist = asset.apiId.startsWith('BIST:');
            const yahooSymbol = isBist
                ? asset.apiId.replace('BIST:', '') + '.IS'
                : asset.apiId.replace('NASDAQ:', '');
            series = await fetchYahooSeries(yahooSymbol, range);
            // If NASDAQ, convert USD prices → TRY using daily rate
            if (!isBist) {
                series = series.map(p => {
                    const rate = usdTryMap.get(p.date);
                    return { date: p.date, price: rate ? p.price * rate : p.price };
                });
            }
        }

        return { amount: asset.amount, series };
    }));

    // Step 3: aggregate by date — sum across all assets
    const dateMap = new Map<string, number>();

    for (const result of seriesResults) {
        if (result.status !== 'fulfilled') continue;
        const { amount, series } = result.value;
        for (const { date, price } of series) {
            dateMap.set(date, (dateMap.get(date) ?? 0) + amount * price);
        }
    }

    // Step 4: sort and return
    const points = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }));

    return NextResponse.json({ points });
}
