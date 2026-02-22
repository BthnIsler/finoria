import { NextRequest, NextResponse } from 'next/server';

// Dynamic stock search via Yahoo Finance
// Supports both BIST (.IS suffix) and NASDAQ/US stocks
export async function GET(request: NextRequest) {
    const q = request.nextUrl.searchParams.get('q') || '';
    const market = request.nextUrl.searchParams.get('market') || 'all'; // 'BIST' | 'NASDAQ' | 'all'

    if (!q || q.length < 1) {
        return NextResponse.json({ results: [] });
    }

    try {
        // Yahoo Finance search endpoint (public, no key required)
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&listsCount=0`;

        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });

        if (!res.ok) {
            return NextResponse.json({ results: [] });
        }

        const data = await res.json();
        const quotes = data?.quotes || [];

        const results = quotes
            .filter((q: any) => q.quoteType === 'EQUITY')
            .map((q: any) => {
                const symbol = q.symbol || '';
                const isBIST = symbol.endsWith('.IS');
                const cleanSymbol = isBIST ? symbol.replace('.IS', '') : symbol;
                const detectedMarket = isBIST ? 'BIST' : 'NASDAQ';

                return {
                    symbol: cleanSymbol,
                    name: q.shortname || q.longname || cleanSymbol,
                    market: detectedMarket,
                    exchange: q.exchange || '',
                    yahooSymbol: symbol,
                };
            })
            .filter((r: any) => {
                if (market === 'BIST') return r.market === 'BIST';
                if (market === 'NASDAQ') return r.market === 'NASDAQ';
                return true;
            });

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Stock search error:', error);
        return NextResponse.json({ results: [] });
    }
}
