import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code || code.length !== 3) {
        return NextResponse.json(
            { error: 'Geçersiz fon kodu (Örn: MAC)' },
            { status: 400 }
        );
    }

    const fundCode = code.toUpperCase();

    try {
        const response = await fetch(`https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${fundCode}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            next: {
                revalidate: 3600 // Cache for 1 hour
            }
        });

        if (!response.ok) {
            throw new Error(`TEFAS responded with status: ${response.status}`);
        }

        const html = await response.text();

        // Extrakt "Son Fiyat (TL)"
        const priceRegex = /Son Fiyat\s*\(TL\)[^<]*<br\s*\/>[^<]*<br\s*\/>[^<]*<span>([\d,]+)<\/span>/i;
        const priceMatch = html.match(priceRegex);

        // Extrakt "Fon Unvanı" (Fund Name, usually in main title tag or header)
        // Usually like: <span id="MainContent_FormViewMainIndicators_LabelFund">Marmara Capital Portföy Hisse Senedi Fonu (Hisse Senedi Yoğun Fon)</span>
        const nameRegex = /<span\s+id="MainContent_FormViewMainIndicators_LabelFund"[^>]*>(.*?)<\/span>/i;
        const nameMatch = html.match(nameRegex);

        if (!priceMatch) {
            return NextResponse.json(
                { error: 'Fon verisi bulunamadı veya çözümlenemedi.' },
                { status: 404 }
            );
        }

        const priceStr = priceMatch[1].replace(',', '.');
        const price = parseFloat(priceStr);
        let name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : `${fundCode} Fonu`;

        // Attempt to clean up HTML entities
        name = name.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

        return NextResponse.json({
            symbol: fundCode,
            name: name,
            price: price,
            currency: 'TRY',
            type: 'fund',
            timestamp: Date.now()
        });

    } catch (error: any) {
        console.error('TEFAS API error:', error);
        return NextResponse.json(
            { error: 'TEFAS verilerine erişilemedi.', details: error.message },
            { status: 500 }
        );
    }
}
