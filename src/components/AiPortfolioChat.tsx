'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Asset, CATEGORIES } from '@/lib/types';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface AiPortfolioChatProps {
    assets: Asset[];
    totalWealth: number;
    totalPL: number;
    totalPLPct: number;
    fmt: (v: number) => string;
}

export default function AiPortfolioChat({ assets, totalWealth, totalPL, totalPLPct, fmt }: AiPortfolioChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
        'Çeşitlendirme tavsiyesi ver',
        'Risk analizi yap',
        'Hangi varlığımı satmalıyım?',
    ];

    if (!isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 20, padding: '16px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'all 0.3s', marginTop: 16,
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
            >
                <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(34,211,238,0.15))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                }}>🤖</div>
                <div>
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>AI Portföy Asistanı</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Portföyünüz hakkında sorular sorun, analiz isteyin</p>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 18 }}>💬</span>
            </div>
        );
    }

    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 24, overflow: 'hidden', marginTop: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            animation: 'fadeIn 0.3s ease',
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'relative',
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-cyan), transparent)',
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                        width: 36, height: 36, borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(34,211,238,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                    }}>🤖</span>
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 700 }}>AI Portföy Asistanı</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Groq · llama-3.3-70b</p>
                    </div>
                </div>
                <button onClick={() => setIsExpanded(false)} style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 10, width: 30, height: 30, cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 12, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                }}>▾</button>
            </div>

            {/* Messages */}
            <div style={{
                padding: '16px 20px', minHeight: 160, maxHeight: 360, overflowY: 'auto',
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                        <p style={{ fontSize: 28, marginBottom: 8 }}>💬</p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                            Portföyünüz hakkında bana soru sorun!
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => { setInput(s); }}
                                    style={{
                                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                        borderRadius: 12, padding: '8px 14px', fontSize: 11,
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
                        marginBottom: 12,
                    }}>
                        <div style={{
                            maxWidth: '85%', padding: '12px 16px', borderRadius: 16,
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))'
                                : 'var(--bg-elevated)',
                            color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                            fontSize: 13, lineHeight: 1.7, fontWeight: msg.role === 'user' ? 500 : 400,
                            borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                            borderBottomLeftRadius: msg.role === 'user' ? 16 : 4,
                            whiteSpace: 'pre-wrap',
                        }}>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                        <div style={{
                            background: 'var(--bg-elevated)', borderRadius: 16,
                            padding: '14px 20px', display: 'flex', gap: 6,
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
                padding: '12px 16px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 10, alignItems: 'center',
            }}>
                <input
                    type="text" value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Portföyünüz hakkında soru sorun..."
                    style={{
                        flex: 1, padding: '12px 16px', borderRadius: 14,
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                    }}
                    disabled={loading}
                />
                <button onClick={sendMessage} disabled={loading || !input.trim()}
                    style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: input.trim() ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' : 'var(--bg-elevated)',
                        border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                        color: input.trim() ? 'white' : 'var(--text-muted)',
                        fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s', flexShrink: 0,
                    }}
                >↑</button>
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
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
            `}</style>
        </div>
    );
}
