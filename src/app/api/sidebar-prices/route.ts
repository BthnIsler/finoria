import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const symbol = req.nextUrl.searchParams.get('symbol');
    if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 300 }, // 5-min cache
        });

        if (!res.ok) return NextResponse.json({ price: null, change: null });

        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];

        // Last two non-null closes
        const validCloses = closes.filter((c: number | null) => c != null) as number[];
        if (validCloses.length === 0) return NextResponse.json({ price: null, change: null });

        let price = validCloses[validCloses.length - 1];
        const prev = validCloses.length >= 2 ? validCloses[validCloses.length - 2] : null;
        const change = prev != null && prev > 0 ? ((price - prev) / prev) * 100 : null;

        // For GC=F (gold in USD/oz), convert to TRY gram
        if (symbol === 'GC=F') {
            try {
                const fxRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=1d', { next: { revalidate: 300 } });
                const fxData = await fxRes.json();
                const rate = fxData?.chart?.result?.[0]?.meta?.regularMarketPrice;
                if (rate) {
                    price = (price * rate) / 31.1035;
                }
            } catch (e) {
                // Ignore fx error
            }
        }
        
        // For USDTRY/EURTRY — price is already in TRY
        return NextResponse.json({ price, change });
    } catch {
        return NextResponse.json({ price: null, change: null });
    }
}
