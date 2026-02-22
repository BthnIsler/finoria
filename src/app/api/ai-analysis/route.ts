import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function POST(request: NextRequest) {
    try {
        const { assetName, assetCategory, symbol } = await request.json();

        if (!assetName) {
            return NextResponse.json({ error: 'Asset name required' }, { status: 400 });
        }

        const prompt = `Sen bir finans uzmanısın. "${assetName}" ${assetCategory === 'stock' ? `(${symbol}) hisse senedi` : assetCategory === 'crypto' ? 'kripto para' : assetCategory === 'gold' ? 'altın' : assetCategory === 'forex' ? 'döviz' : 'yatırım aracı'} hakkında kısa bir analiz yap.

Aşağıdaki başlıklar altında KISA ve ÖZ bilgiler ver (her biri max 2 cümle):

📊 Güncel Durum: Şu anki piyasa durumu
📈 Kısa Vadeli Görünüm: Önümüzdeki haftalarda ne bekleniyor
🔮 Uzun Vadeli Tahmin: 6-12 aylık görünüm
💡 Analist Tavsiyesi: Al/Sat/Tut önerisi ve kısa gerekçe
🌐 Sosyal Medya Sentimenti: Yatırımcılar ne düşünüyor

Türkçe yanıt ver. Çok uzun yazma, her başlık max 2 cümle olsun.`;

        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'Sen kısa ve öz yanıtlar veren bir Türk finans analistisin. Emojiler kullan. Yanıtların her zaman kısa olsun.',
                    },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 500,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Groq API error:', errText);
            return NextResponse.json({ error: 'AI analiz hatası' }, { status: 500 });
        }

        const data = await res.json();
        const analysis = data.choices?.[0]?.message?.content || 'Analiz alınamadı.';

        return NextResponse.json({ analysis });
    } catch (error) {
        console.error('AI analysis error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
