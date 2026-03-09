'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Asset, CATEGORIES } from '@/lib/types';
import { useAuth } from '@/lib/AuthContext';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface AiPortfolioChatProps {
    assets: Asset[];
    totalWealth: number;
    totalPL: number;
    totalPLPct: number;
    dailyPL: number;
    dailyPLPct: number;
    fmt: (v: number) => string;
    inline?: boolean;
}

export default function AiPortfolioChat({ assets, totalWealth, totalPL, totalPLPct, dailyPL, dailyPLPct, fmt, inline = false }: AiPortfolioChatProps) {
    const { user, displayName } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(inline ? true : false);
    const [showBubble, setShowBubble] = useState(!inline);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Use display name from auth context
    const name = displayName || 'Dostum';

    // Generate personalized greeting for the speech bubble — uses DAILY P&L
    const getBubbleGreeting = () => {
        const hour = new Date().getHours();
        const timeGreet = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

        if (dailyPLPct > 0) {
            const greetings = [
                `${timeGreet} ${name}! 🎉 Bugün portföyün %${dailyPLPct.toFixed(1)} yükseldi, harika gidiyorsun! Sohbet edelim mi?`,
                `Selam ${name}! Bugün işler yolunda, portföyün %${dailyPLPct.toFixed(1)} kazandırdı 💪 Konuşmak için tıkla!`,
                `Hey ${name}! Bugünkü performansın bayağı iyi (+%${dailyPLPct.toFixed(1)}), detaylara bakmak ister misin? 📈`,
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        } else if (dailyPLPct < 0) {
            const greetings = [
                `${timeGreet} ${name}! Piyasalar biraz sallantıda, portföyün bugün %${Math.abs(dailyPLPct).toFixed(1)} düştü. Birlikte bakalım 💪`,
                `Selam ${name}! Bugün %${Math.abs(dailyPLPct).toFixed(1)} düşüş var ama moralini bozma, fırsatlar her zaman vardır 🌟`,
                `Hey ${name}! Portföyün bugün -%${Math.abs(dailyPLPct).toFixed(1)} gördü. Hadi birlikte bakalım 🚀`,
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        const greetings = [
            `${timeGreet} ${name}! Portföyün hakkında sohbet etmek ister misin? Ben buradayım 😊`,
            `Selam ${name}! Bugün yatırım planlarını konuşalım mı? Tıkla başlayalım 🎯`,
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    };

    // Initial greeting for chat
    useEffect(() => {
        if (messages.length === 0 && isOpen) {
            const hour = new Date().getHours();
            const timeGreet = hour < 12 ? 'Günaydın' : hour < 18 ? 'Merhaba' : 'İyi akşamlar';

            let greeting: string;
            if (totalPL > 0) {
                const opts = [
                    `${timeGreet} ${name}! 🎉 Ben Finoria, senin kişisel yatırım asistanın. Bugün portföyün %${totalPLPct.toFixed(1)} kârda, tebrik ederim! Bu ivmeyi nasıl sürdürebileceğini konuşalım mı?`,
                    `Selam ${name}! Harika bir gün, portföyün kazandırmaya devam ediyor 💪 Sana özel taktiklerim var, ne dersin?`,
                ];
                greeting = opts[Math.floor(Math.random() * opts.length)];
            } else if (totalPL < 0) {
                const opts = [
                    `${timeGreet} ${name}! Ben Finoria, her zaman yanındayım 💪 Piyasalar biraz zor ama birlikte düzeltiriz. Hadi portföyünü analiz edelim, ne dersin?`,
                    `Selam ${name}! Bugün biraz kaybetmiş olabilirsin ama moralini bozma, bu tür dönemler geçici. Birlikte strateji kuralım mı? 🚀`,
                ];
                greeting = opts[Math.floor(Math.random() * opts.length)];
            } else {
                greeting = `${timeGreet} ${name}! Ben Finoria, senin kişisel yatırım asistanın 😊 Portföyün hakkında konuşalım mı? Sana en iyi tavsiyeleri vermeye hazırım!`;
            }

            setMessages([{ role: 'assistant', content: greeting }]);
        }
    }, [isOpen, totalPL, totalPLPct, messages.length]);

    const buildPortfolioContext = () => {
        const categories: Record<string, { count: number; totalValue: number; items: string[] }> = {};
        for (const a of assets) {
            const cat = CATEGORIES.find((c) => c.key === a.category) || { labelTR: a.category };
            if (!categories[cat.labelTR]) categories[cat.labelTR] = { count: 0, totalValue: 0, items: [] };
            const price = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
            categories[cat.labelTR].count++;
            categories[cat.labelTR].totalValue += a.amount * price;
            categories[cat.labelTR].items.push(`${a.name} (${a.amount} adet, değer: ${fmt(a.amount * price)})`);
        }

        let ctx = `Kullanıcının portföy bilgileri:\n`;
        ctx += `- Toplam Servet: ${fmt(totalWealth)}\n`;
        ctx += `- Toplam Maliyet: ${fmt(totalWealth - totalPL)}\n`;
        ctx += `- Kar/Zarar: ${fmt(totalPL)} (${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(1)}%)\n`;
        ctx += `- Toplam Varlık Sayısı: ${assets.length}\n\n`;

        for (const [catName, info] of Object.entries(categories)) {
            ctx += `${catName} (${info.count} adet, toplam: ${fmt(info.totalValue)}):\n`;
            for (const item of info.items) ctx += `  • ${item}\n`;
            ctx += `\n`;
        }
        return ctx;
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMsg: ChatMessage = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const portfolioCtx = buildPortfolioContext();
            const allMessages = [
                ...messages,
                userMsg,
            ].map((m) => ({ role: m.role, content: m.content }));

            const res = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: allMessages,
                    portfolioContext: portfolioCtx,
                }),
            });

            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
        } catch {
            setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ Bir hata oluştu, lütfen tekrar deneyin.' }]);
        } finally {
            setLoading(false);
        }
    };

    const suggestions = [
        'Portföyümü analiz et',
        'En çok yükselen varlığımı göster',
        'En çok düşen varlığımı göster',
        'Çeşitlendirme tavsiyesi ver',
        'Risk analizi yap',
        'Hangi varlığımı satmalıyım?',
    ];

    return (
        <>
            {/* Premium greeting card bubble */}
            {!inline && showBubble && !isOpen && (() => {
                const isUp = dailyPLPct >= 0;

                // Find best / worst asset by currentPrice vs purchasePrice
                const assetPerfs = assets.map(a => {
                    const cur = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
                    const pct = a.purchasePrice > 0 ? ((cur - a.purchasePrice) / a.purchasePrice) * 100 : 0;
                    return { name: a.name, pct };
                });
                const bestAsset = [...assetPerfs].sort((a, b) => b.pct - a.pct)[0];
                const worstAsset = [...assetPerfs].sort((a, b) => a.pct - b.pct)[0];
                const featuredAsset = isUp ? bestAsset : worstAsset;

                const greetLine2 = isUp
                    ? `Portföyün bugün %${Math.abs(dailyPLPct).toFixed(2)} büyüdü 🎉`
                    : `Portföyün bugün %${Math.abs(dailyPLPct).toFixed(2)} küçüldü`;

                const greetLine3 = featuredAsset
                    ? isUp
                        ? `En çok yükselen yatırımın ${featuredAsset.pct >= 0 ? `+${featuredAsset.pct.toFixed(1)}%` : ''} ile ${featuredAsset.name}.`
                        : `En çok düşen yatırımın ${featuredAsset.name}. Tıkla ve birlikte inceleyelim.`
                    : '';

                const accentColor = isUp ? '#10b981' : '#ef4444';

                return (
                    <div
                        onClick={() => { setShowBubble(false); setIsOpen(true); }}
                        style={{
                            position: 'fixed', bottom: 90, right: 24, zIndex: 999,
                            width: 300,
                            background: 'linear-gradient(145deg, rgba(17,24,39,0.97), rgba(13,17,23,0.99))',
                            border: `1px solid ${accentColor}33`,
                            borderRadius: 20, borderBottomRightRadius: 6,
                            padding: '0', overflow: 'hidden',
                            boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}11`,
                            cursor: 'pointer',
                            animation: 'bubbleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                        }}
                    >
                        {/* Accent top bar */}
                        <div style={{
                            height: 3,
                            background: isUp
                                ? 'linear-gradient(90deg, #10b981, #34d399, transparent)'
                                : 'linear-gradient(90deg, #ef4444, #f97316, transparent)',
                        }} />

                        {/* Ambient glow */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accentColor}0a, transparent)`,
                            pointerEvents: 'none',
                        }} />

                        {/* Close button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowBubble(false); }}
                            style={{
                                position: 'absolute', top: 10, right: 10,
                                width: 20, height: 20, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.4)', fontSize: 9,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 10,
                            }}
                        >✕</button>

                        <div style={{ padding: '16px 18px 18px' }}>
                            {/* Avatar + robot icon */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <div style={{
                                    width: 38, height: 38, borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: `1px solid ${accentColor}44`,
                                    flexShrink: 0,
                                }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/finoria-ai.png" alt="Finoria AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>Finoria AI</div>
                                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Kişisel Finans Asistanın</div>
                                </div>
                            </div>

                            {/* Greeting lines */}
                            <div style={{ marginBottom: 14 }}>
                                <p style={{
                                    fontSize: 15, fontWeight: 800, color: '#fff',
                                    margin: '0 0 6px', letterSpacing: -0.3,
                                }}>
                                    Selam {name}! 👋
                                </p>
                                <p style={{
                                    fontSize: 13, fontWeight: 600, margin: '0 0 6px',
                                    color: isUp ? '#34d399' : '#f87171',
                                }}>
                                    {greetLine2}
                                </p>
                                {greetLine3 && (
                                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.5 }}>
                                        {greetLine3}
                                    </p>
                                )}
                            </div>

                            {/* CTA button */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '9px 14px',
                                background: `${accentColor}18`,
                                border: `1px solid ${accentColor}33`,
                                borderRadius: 10, transition: 'all 0.15s',
                            }}
                                onMouseOver={e => (e.currentTarget.style.background = `${accentColor}28`)}
                                onMouseOut={e => (e.currentTarget.style.background = `${accentColor}18`)}
                            >
                                <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>Birlikte inceleyelim mi?</span>
                                <span style={{ fontSize: 16, color: accentColor }}>→</span>
                            </div>
                        </div>
                    </div>
                );
            })()} 

            {/* Floating mascot button */}
            {!inline && (
                <button
                    onClick={() => { setIsOpen(!isOpen); setShowBubble(false); }}
                    style={{
                        position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
                        width: isOpen ? 56 : 72, height: isOpen ? 56 : 72, borderRadius: isOpen ? 16 : '50%',
                        background: isOpen
                            ? 'linear-gradient(135deg, #374151, #1f2937)'
                            : 'transparent',
                        border: isOpen ? '1px solid rgba(255,255,255,0.1)' : 'none',
                        cursor: 'pointer',
                        boxShadow: isOpen
                            ? '0 4px 16px rgba(0,0,0,0.3)'
                            : '0 8px 32px rgba(99,102,241,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                        padding: 0, overflow: 'hidden',
                        animation: isOpen ? 'none' : 'mascotFloat 3s ease-in-out infinite',
                    }}
                >
                    {isOpen ? (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M2 2L16 16M16 2L2 16" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src="/finoria-ai.png"
                            alt="Finoria AI"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                        />
                    )}
                </button>
            )}

            {/* Chat panel */}
            {isOpen && (
                <div style={{
                    position: inline ? 'relative' : 'fixed',
                    bottom: inline ? 'auto' : 92,
                    right: inline ? 'auto' : 24,
                    zIndex: inline ? 10 : 999,
                    width: inline ? '100%' : 380,
                    maxWidth: inline ? 800 : '100%',
                    height: inline ? 'calc(100vh - 180px)' : 'auto',
                    minHeight: inline ? 400 : 'auto',
                    maxHeight: inline ? 'none' : 520,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 24, overflow: 'hidden',
                    boxShadow: inline ? 'none' : '0 16px 48px rgba(0,0,0,0.3)',
                    animation: 'chatPanelIn 0.3s ease',
                    display: 'flex', flexDirection: 'column',
                }}>
                    {/* Header */}
                    {/* Header: AI Name + Mascot */}
                    <div style={{
                        padding: '16px 20px', borderBottom: '1px solid var(--border)',
                        background: 'linear-gradient(to right, rgba(167,139,250,0.1), rgba(34,211,238,0.05))',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {/* Finoria AI Mascot Avatar */}
                            <div style={{
                                width: 42, height: 42, borderRadius: '50%',
                                overflow: 'hidden',
                                boxShadow: '0 4px 12px rgba(129,140,248,0.3)',
                                border: '2px solid rgba(129,140,248,0.35)',
                                flexShrink: 0,
                            }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/finoria-ai.png"
                                    alt="Finoria AI"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, letterSpacing: -0.3, color: 'var(--text-primary)' }}>Finoria AI</h3>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', boxShadow: '0 0 8px var(--accent-green)' }} />
                                    Çevrimiçi
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div style={{
                        padding: '14px 16px', flex: 1, overflowY: 'auto',
                        minHeight: 200, maxHeight: 340,
                    }}>
                        {messages.length === 1 && messages[0].role === 'assistant' && (
                            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                    {suggestions.map((s, i) => (
                                        <button key={i} onClick={() => { setInput(s); }}
                                            style={{
                                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                                borderRadius: 10, padding: '6px 12px', fontSize: 10,
                                                color: 'var(--text-secondary)', cursor: 'pointer',
                                                transition: 'all 0.2s', fontWeight: 500,
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                                            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                        >{s}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                marginBottom: 10,
                            }}>
                                <div style={{
                                    maxWidth: '85%', padding: '10px 14px', borderRadius: 14,
                                    background: msg.role === 'user'
                                        ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))'
                                        : 'var(--bg-elevated)',
                                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                                    fontSize: 12, lineHeight: 1.7, fontWeight: msg.role === 'user' ? 500 : 400,
                                    borderBottomRightRadius: msg.role === 'user' ? 4 : 14,
                                    borderBottomLeftRadius: msg.role === 'user' ? 14 : 4,
                                    whiteSpace: 'pre-wrap',
                                }}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                                <div style={{
                                    background: 'var(--bg-elevated)', borderRadius: 14,
                                    padding: '12px 18px', display: 'flex', gap: 5,
                                }}>
                                    <span className="typing-dot" style={{ animationDelay: '0s' }}>●</span>
                                    <span className="typing-dot" style={{ animationDelay: '0.2s' }}>●</span>
                                    <span className="typing-dot" style={{ animationDelay: '0.4s' }}>●</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{
                        padding: '10px 14px', borderTop: '1px solid var(--border)',
                        display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                        <input
                            type="text" value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Portföyünüz hakkında soru sorun..."
                            style={{
                                flex: 1, padding: '10px 14px', borderRadius: 12,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                            }}
                            disabled={loading}
                        />
                        <button onClick={sendMessage} disabled={loading || !input.trim()}
                            style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: input.trim() ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' : 'var(--bg-elevated)',
                                border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                                color: input.trim() ? 'white' : 'var(--text-muted)',
                                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s', flexShrink: 0,
                            }}
                        >↑</button>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes bubbleIn {
                    from { opacity: 0; transform: translateY(10px) scale(0.9); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes chatPanelIn {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes mascotFloat {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    25% { transform: translateY(-5px) rotate(-2deg); }
                    50% { transform: translateY(-8px) rotate(0deg); }
                    75% { transform: translateY(-4px) rotate(2deg); }
                }
                @keyframes mascotGlow {
                    0%, 100% { box-shadow: 0 8px 32px rgba(99,102,241,0.35); }
                    50% { box-shadow: 0 12px 40px rgba(99,102,241,0.65), 0 0 20px rgba(139,92,246,0.4); }
                }
                .typing-dot {
                    color: var(--text-muted);
                    font-size: 10px;
                    animation: bounce 1.2s infinite;
                }
                @keyframes bounce {
                    0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
                    40% { opacity: 1; transform: translateY(-4px); }
                }
                @media (max-width: 480px) {
                    div[style*="position: fixed"][style*="width: 380px"] {
                        width: calc(100vw - 32px) !important;
                        right: 16px !important;
                        bottom: 86px !important;
                    }
                }
            `}</style>
        </>
    );
}
