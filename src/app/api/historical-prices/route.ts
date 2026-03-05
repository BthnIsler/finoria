import { NextRequest, NextResponse } from 'next/server';

type AssetInput = { apiId: string; category: string; amount: number; };

type OHLCSeries = { date: string; open: number; high: number; low: number; close: number }[];

const RANGE_MAP: Record<string, string> = { '1w': '1mo', '1m': '1mo', '3m': '3mo', '1y': '1y', '3y': '3y', 'all': '5y' };
const DAYS_MAP: Record<string, number> = { '1w': 7, '1m': 30, '3m': 90, '1y': 365, '3y': 1095, 'all': 1825 };

// Fetch USD→TRY rate for a specific date range from Yahoo Finance
async function fetchUsdTrySeries(range: string): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=${range}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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

// Fetch historical OHLC prices for a Yahoo Finance symbol
async function fetchYahooSeries(yahooSymbol: string, range: string): Promise<OHLCSeries> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=${range}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return [];
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const timestamps: number[] = result?.timestamp ?? [];
        const quote = result?.indicators?.quote?.[0];
        if (!quote) return [];
        
        return timestamps.map((ts, i) => ({
            date: new Date(ts * 1000).toISOString().split('T')[0],
            open: quote.open?.[i] ?? quote.close?.[i] ?? 0,
            high: quote.high?.[i] ?? quote.close?.[i] ?? 0,
            low: quote.low?.[i] ?? quote.close?.[i] ?? 0,
            close: quote.close?.[i] ?? 0,
        })).filter(p => p.close > 0);
    } catch {
        return [];
    }
}

// Fetch historical closing prices for a CoinGecko crypto ID. Mocks OHLC based on close.
async function fetchCoinGeckoSeries(coinId: string, days: number): Promise<OHLCSeries> {
    try {
        const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=try&days=${days}&interval=daily`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        const prices: [number, number][] = data?.prices ?? [];
        
        let prevClose = 0;
        return prices.map(([ts, price]) => {
            const open = prevClose > 0 ? prevClose : price;
            prevClose = price;
            return {
                date: new Date(ts).toISOString().split('T')[0],
                open, high: Math.max(open, price) * 1.01, low: Math.min(open, price) * 0.99, close: price,
            };
        });
    } catch {
        return [];
    }
}

export async function POST(request: NextRequest) {
    const { assets, period }: { assets: AssetInput[]; period: string } = await request.json();

    const range = RANGE_MAP[period] ?? '1y';
    const days = DAYS_MAP[period] ?? 365;

    if (!assets || assets.length === 0) return NextResponse.json({ points: [] });

    // Step 1: fetch USD→TRY series for conversions
    const needsUsdConversion = assets.some(a => 
        (a.category === 'stock' && !a.apiId.startsWith('BIST:')) || 
        a.category === 'precious_metals'
    );
    const usdTryMap = needsUsdConversion ? await fetchUsdTrySeries(range) : new Map<string, number>();

    // Step 2: fetch price series for each asset
    const seriesResults = await Promise.allSettled(assets.map(async (asset) => {
        let series: OHLCSeries = [];

        if (asset.category === 'crypto' && asset.apiId) {
            series = await fetchCoinGeckoSeries(asset.apiId, days);
        } else if (asset.category === 'gold') {
            const cgSeries = await fetchCoinGeckoSeries('tether-gold', days);
            // Convert per ounce to per gram
            series = cgSeries.map(p => ({
                date: p.date, 
                open: p.open / 31.1035, high: p.high / 31.1035, 
                low: p.low / 31.1035, close: p.close / 31.1035
            }));
        } else if (asset.category === 'precious_metals') {
            // XAG = Silver, XPT = Platinum, XPD = Palladium
            const symbolMap: Record<string, string> = { 'XAG': 'SI=F', 'XPT': 'PL=F', 'XPD': 'PA=F' };
            const yahooSymbol = symbolMap[asset.apiId];
            if (yahooSymbol) {
                const rawSeries = await fetchYahooSeries(yahooSymbol, range);
                series = rawSeries.map(p => {
                    const rate = usdTryMap.get(p.date) ?? 1;
                    return {
                        date: p.date,
                        open: (p.open * rate) / 31.1035, high: (p.high * rate) / 31.1035,
                        low: (p.low * rate) / 31.1035, close: (p.close * rate) / 31.1035
                    };
                });
            }
        } else if (asset.category === 'forex' && asset.apiId) {
            if (asset.apiId === 'TRY') return { amount: asset.amount, series: [] };
            series = await fetchYahooSeries(`${asset.apiId}TRY=X`, range);
        } else if (asset.category === 'stock' && asset.apiId) {
            const isBist = asset.apiId.startsWith('BIST:');
            const yahooSymbol = isBist ? asset.apiId.replace('BIST:', '') + '.IS' : asset.apiId.replace('NASDAQ:', '');
            series = await fetchYahooSeries(yahooSymbol, range);
            if (!isBist) {
                series = series.map(p => {
                    const rate = usdTryMap.get(p.date) ?? 1; // fallback is tricky, better to have rate
                    return {
                        date: p.date,
                        open: p.open * rate, high: p.high * rate, low: p.low * rate, close: p.close * rate
                    };
                });
            }
        }

        return { amount: asset.amount, series };
    }));

    // Step 3: aggregate by date
    const aggregated = new Map<string, { open: number, high: number, low: number, close: number }>();

    for (const result of seriesResults) {
        if (result.status !== 'fulfilled') continue;
        const { amount, series } = result.value;
        for (const p of series) {
            const existing = aggregated.get(p.date) ?? { open: 0, high: 0, low: 0, close: 0 };
            aggregated.set(p.date, {
                open: existing.open + amount * p.open,
                high: existing.high + amount * p.high,
                low: existing.low + amount * p.low,
                close: existing.close + amount * p.close,
            });
        }
    }

    // Step 4: sort and return
    const points = Array.from(aggregated.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
            date,
            value: vals.close, // backward compat
            open: vals.open,
            high: vals.high,
            low: vals.low,
            close: vals.close
        }));

    return NextResponse.json({ points });
}
