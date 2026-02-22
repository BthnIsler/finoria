import { NextRequest, NextResponse } from 'next/server';

// Fetch stock prices via Yahoo Finance (free, no API key needed)
// BIST stocks use .IS suffix (e.g., THYAO.IS), NASDAQ stocks used directly
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbols = searchParams.get('symbols');

    if (!symbols) {
        return NextResponse.json({ prices: {} });
    }

    const symbolList = symbols.split(',').map((s) => s.trim()).filter(Boolean);
    const prices: Record<string, { price: number; change: number | null }> = {};

    try {
        // Pre-fetch USD/TRY rate once (for non-BIST stocks)
        const hasNonBist = symbolList.some((s) => !s.startsWith('BIST:'));
        let usdTryRate: number | null = null;
        if (hasNonBist) {
            try {
                const fxRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=1d', {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                });
                if (fxRes.ok) {
                    const fxData = await fxRes.json();
                    usdTryRate = fxData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
                }
            } catch {
                console.warn('USD/TRY rate fetch failed, using fallback');
            }
        }

        // Fetch all symbols in parallel
        const results = await Promise.allSettled(
            symbolList.map(async (symbol) => {
                const yahooSymbol = symbol.startsWith('BIST:')
                    ? symbol.replace('BIST:', '') + '.IS'
                    : symbol.replace('NASDAQ:', '');

                const originalKey = symbol;

                // Yahoo Finance v8 API (public, no key needed)
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;

                const res = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                });

                if (!res.ok) {
                    throw new Error(`Yahoo Finance error for ${yahooSymbol}: ${res.status}`);
                }

                const data = await res.json();
                const meta = data?.chart?.result?.[0]?.meta;

                if (meta?.regularMarketPrice) {
                    let price = meta.regularMarketPrice;

                    // If the stock is from BIST, price is already in TRY
                    // If NASDAQ, price is in USD — convert to TRY
                    if (!symbol.startsWith('BIST:') && usdTryRate) {
                        price = price * usdTryRate;
                    }

                    const prevClose = meta.chartPreviousClose || meta.previousClose;
                    const change = prevClose ? ((meta.regularMarketPrice - prevClose) / prevClose) * 100 : null;

                    return { key: originalKey, price, change };
                }

                return null;
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                prices[result.value.key] = {
                    price: result.value.price,
                    change: result.value.change,
                };
            }
        }
    } catch (error) {
        console.error('Stock price fetch error:', error);
    }

    return NextResponse.json({ prices });
}
