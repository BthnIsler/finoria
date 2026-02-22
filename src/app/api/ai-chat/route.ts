import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function POST(request: NextRequest) {
    try {
        const { messages, portfolioContext } = await request.json();

        const systemPrompt = `Sen bir Türk finans danışmanısın ve portföy asistanısın. Kullanıcıya portföyü hakkında yardımcı ol.
        
Aşağıda kullanıcının portföy bilgileri verilmiştir:

${portfolioContext}

Kurallar:
- Her zaman Türkçe yanıt ver
- Kısa ve öz cevap ver (max 3-4 cümle, gerekirse daha uzun)
- Emojiler kullan
- Somut ve faydalı tavsiyeler ver
- Portföy verisini kullanarak kişiselleştirilmiş öneriler sun
- Eğer kullanıcı bir analiz isterse, verilerine dayanarak analiz yap`;

        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                ],
                temperature: 0.7,
                max_tokens: 600,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Groq chat error:', errText);
            return NextResponse.json({ error: 'AI hatası' }, { status: 500 });
        }

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || 'Yanıt alınamadı.';

        return NextResponse.json({ reply });
    } catch (error) {
        console.error('AI chat error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
