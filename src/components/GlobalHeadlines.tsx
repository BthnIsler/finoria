'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface HeadlineArticle {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

const formatTimeAgo = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMin = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        if (diffMin < 1) return 'Az önce';
        if (diffMin < 60) return `${diffMin}dk`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH}sa`;
        const diffD = Math.floor(diffH / 24);
        return `${diffD}g`;
    } catch { return ''; }
};

export default function GlobalHeadlines() {
    const [articles, setArticles] = useState<HeadlineArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    const fetchNews = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/news?q=${encodeURIComponent('global stock market economy gold crypto Fed interest rates finance')}`);
            if (!res.ok) throw new Error('News API failed');
            const data = await res.json();
            setArticles(data.articles || []);
        } catch (err) {
            console.error('[GlobalHeadlines] fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
        const interval = setInterval(fetchNews, 5 * 60 * 1000); // refresh every 5 min
        return () => clearInterval(interval);
    }, [fetchNews]);

    const visibleArticles = expanded ? articles : articles.slice(0, 4);

    return (
        <div style={{
            background: '#0d1117',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'linear-gradient(135deg, #f59e0b22, #ef444422)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15,
                    }}>📰</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
                            Gündem Haberleri
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                            GLOBAL FİNANS & PİYASA
                        </div>
                    </div>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    {!loading && (
                        <button
                            onClick={fetchNews}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 6, padding: '4px 8px',
                                color: 'rgba(255,255,255,0.4)', fontSize: 10,
                                cursor: 'pointer', transition: 'all 0.15s',
                                fontWeight: 600,
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                        >
                            ↻ Yenile
                        </button>
                    )}
                    {loading && (
                        <div style={{
                            width: 14, height: 14, border: '2px solid rgba(255,255,255,0.1)',
                            borderTop: '2px solid #f59e0b', borderRadius: '50%',
                            animation: 'headlineSpin 0.8s linear infinite',
                        }} />
                    )}
                </div>
            </div>

            {/* Body */}
            {loading && articles.length === 0 ? (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                            height: 52, borderRadius: 10,
                            background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                        }} />
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📰</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                        Gündem haberleri yüklenemedi. Lütfen tekrar deneyin.
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {visibleArticles.map((article, i) => (
                        <HeadlineCard key={i} article={article} index={i} isLast={i === visibleArticles.length - 1} />
                    ))}

                    {/* Show More / Less */}
                    {articles.length > 4 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            style={{
                                padding: '10px 20px', border: 'none',
                                background: 'transparent', cursor: 'pointer',
                                fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                                color: '#f59e0b',
                                borderTop: '1px solid rgba(255,255,255,0.04)',
                                transition: 'color 0.15s',
                            }}
                            onMouseOver={e => e.currentTarget.style.color = '#fbbf24'}
                            onMouseOut={e => e.currentTarget.style.color = '#f59e0b'}
                        >
                            {expanded ? '▲ Daha Az Göster' : `▼ Tümünü Göster (${articles.length})`}
                        </button>
                    )}
                </div>
            )}

            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes headlineSpin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

// ── Headline Card ──────────────────────────────────────────────────────────────

function HeadlineCard({ article, index, isLast }: { article: HeadlineArticle; index: number; isLast: boolean }) {
    const [hovered, setHovered] = useState(false);

    // Color accents for variety
    const accents = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const accent = accents[index % accents.length];

    return (
        <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 20px',
                textDecoration: 'none',
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                transition: 'background 0.15s',
                cursor: 'pointer',
            }}
        >
            {/* Accent dot */}
            <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: accent, flexShrink: 0, marginTop: 6,
                boxShadow: hovered ? `0 0 8px ${accent}66` : 'none',
                transition: 'box-shadow 0.2s',
            }} />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 12, fontWeight: 600, lineHeight: 1.5,
                    color: hovered ? '#fff' : 'rgba(255,255,255,0.75)',
                    transition: 'color 0.15s',
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as any, overflow: 'hidden',
                }}>
                    {article.title}
                </div>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                    {article.source && (
                        <>
                            <span style={{
                                color: accent, fontWeight: 700,
                                background: `${accent}15`, padding: '1px 6px',
                                borderRadius: 4, letterSpacing: 0.3,
                            }}>
                                {article.source}
                            </span>
                        </>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {formatTimeAgo(article.pubDate)}
                    </span>
                </div>
            </div>

            {/* Arrow */}
            <span style={{
                color: hovered ? accent : 'rgba(255,255,255,0.15)',
                fontSize: 12, flexShrink: 0, marginTop: 2,
                transition: 'color 0.15s, transform 0.15s',
                transform: hovered ? 'translateX(2px)' : 'none',
            }}>
                →
            </span>
        </a>
    );
}
