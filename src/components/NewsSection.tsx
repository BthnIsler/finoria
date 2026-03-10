'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, getCategoryMeta } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NewsArticle {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

interface NewsSectionProps {
    assets: Asset[];
}

type Tab = 'portfolio' | 'global' | 'search';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diffMin < 60) return `${diffMin}dk önce`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH} saat önce`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `${diffD} gün önce`;
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch { return ''; }
};

// Queries in Turkish for relevant results
const buildPortfolioQuery = (assets: Asset[]) => {
    const terms: string[] = [];
    const cats = [...new Set(assets.map(a => a.category))];
    assets.slice(0, 6).forEach(a => terms.push(a.name));
    if (cats.includes('gold')) terms.push('altın');
    if (cats.includes('crypto')) terms.push('kripto bitcoin');
    if (cats.includes('stock')) terms.push('borsa hisse senedi BIST');
    if (cats.includes('forex')) terms.push('dolar euro kur');
    return terms.slice(0, 8).join(' OR ');
};

const GLOBAL_QUERY = 'küresel ekonomi piyasa merkez bankası faiz döviz borsa dünya ekonomisi';

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard({ wide = false }: { wide?: boolean }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.025)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.05)', padding: wide ? '20px' : '14px 16px',
            animation: 'skPulse 1.5s ease-in-out infinite',
        }}>
            {wide && <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', width: '30%', marginBottom: 12 }} />}
            <div style={{ height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.07)', width: '85%', marginBottom: 10 }} />
            <div style={{ height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.05)', width: '65%', marginBottom: 10 }} />
            <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)', width: '40%' }} />
            <style>{`@keyframes skPulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
        </div>
    );
}

// ─── Article card ─────────────────────────────────────────────────────────────
function ArticleCard({ article, accent = '#a78bfa', featured = false }: { article: NewsArticle; accent?: string; featured?: boolean }) {
    const [hovered, setHovered] = useState(false);
    return (
        <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    background: hovered ? 'rgba(255,255,255,0.06)' : (featured ? `${accent}0e` : 'rgba(255,255,255,0.025)'),
                    borderRadius: featured ? 20 : 16,
                    border: `1px solid ${hovered ? `${accent}55` : (featured ? `${accent}33` : 'rgba(255,255,255,0.07)')}`,
                    padding: featured ? '18px 20px' : '13px 15px',
                    transition: 'all 0.2s',
                    position: 'relative', overflow: 'hidden',
                }}
            >
                {/* Accent bar */}
                <div style={{
                    position: 'absolute', left: 0, top: featured ? 20 : 14, bottom: featured ? 20 : 14,
                    width: 3, borderRadius: '0 3px 3px 0',
                    background: `linear-gradient(180deg, ${accent}, ${accent}44)`,
                }} />
                <div style={{ paddingLeft: 10 }}>
                    {featured && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: `${accent}22`, border: `1px solid ${accent}44`,
                            borderRadius: 20, padding: '3px 10px', marginBottom: 10,
                        }}>
                            <div style={{
                                width: 6, height: 6, borderRadius: '50%', background: accent,
                                animation: 'liveBlip 1.2s ease-in-out infinite',
                            }} />
                            <span style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                                Öne Çıkan
                            </span>
                        </div>
                    )}
                    <p style={{
                        fontSize: featured ? 14 : 13, fontWeight: featured ? 700 : 600,
                        color: 'rgba(255,255,255,0.9)', lineHeight: 1.55, margin: '0 0 9px',
                        display: '-webkit-box', WebkitLineClamp: featured ? 3 : 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{article.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, color: accent,
                            background: `${accent}18`, border: `1px solid ${accent}30`,
                            padding: '2px 9px', borderRadius: 20, lineHeight: 1.8,
                        }}>{article.source || 'Haber'}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>
                            {formatDate(article.pubDate)}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 14, color: `${accent}66`, fontWeight: 700 }}>↗</span>
                    </div>
                </div>
                <style>{`
                    @keyframes liveBlip { 0%,100%{opacity:1} 50%{opacity:0.2} }
                `}</style>
            </div>
        </a>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon, text }: { icon: string; text: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', margin: 0, lineHeight: 1.6 }}>{text}</p>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewsSection({ assets }: NewsSectionProps) {
    const [tab, setTab] = useState<Tab>('portfolio');
    const [portfolioNews, setPortfolioNews] = useState<NewsArticle[]>([]);
    const [globalNews, setGlobalNews]  = useState<NewsArticle[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchNews, setSearchNews]   = useState<NewsArticle[]>([]);
    const [loadingPortfolio, setLoadingPortfolio] = useState(false);
    const [loadingGlobal, setLoadingGlobal]       = useState(false);
    const [loadingSearch, setLoadingSearch]       = useState(false);
    const cache = useRef<Record<string, NewsArticle[]>>({});
    const searchInputRef = useRef<HTMLInputElement>(null);

    const fetchNews = useCallback(async (q: string, setter: (a: NewsArticle[]) => void, setLoading: (b: boolean) => void) => {
        if (!q.trim()) return;
        if (cache.current[q]) { setter(cache.current[q]); return; }
        setLoading(true);
        try {
            const r = await fetch(`/api/news?q=${encodeURIComponent(q)}&period=1w`);
            const d = await r.json();
            const result: NewsArticle[] = d.articles || [];
            cache.current[q] = result;
            setter(result);
        } catch { setter([]); }
        finally { setLoading(false); }
    }, []);

    // Fetch portfolio news on mount / asset change
    useEffect(() => {
        if (assets.length === 0) return;
        const q = buildPortfolioQuery(assets);
        fetchNews(q, setPortfolioNews, setLoadingPortfolio);
    }, [assets, fetchNews]);

    // Fetch global news on mount
    useEffect(() => {
        fetchNews(GLOBAL_QUERY, setGlobalNews, setLoadingGlobal);
    }, [fetchNews]);

    // Search handler
    const handleSearch = useCallback(() => {
        const q = searchQuery.trim();
        if (!q) return;
        const trQuery = `${q} haber piyasa ekonomi`;
        fetchNews(trQuery, setSearchNews, setLoadingSearch);
    }, [searchQuery, fetchNews]);

    const TABS: { key: Tab; label: string; icon: string }[] = [
        { key: 'portfolio', label: 'Portföyüm', icon: '📊' },
        { key: 'global',    label: 'Global',     icon: '🌍' },
        { key: 'search',    label: 'Ara',         icon: '🔎' },
    ];

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* ── Tab selector ── */}
            <div style={{
                display: 'flex', gap: 6, marginBottom: 20, padding: 4,
                background: 'rgba(255,255,255,0.03)', borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.06)',
            }}>
                {TABS.map(t => {
                    const active = tab === t.key;
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            flex: 1, padding: '11px 4px', borderRadius: 14,
                            cursor: 'pointer', transition: 'all 0.2s',
                            background: active ? 'linear-gradient(135deg,rgba(99,102,241,0.28),rgba(139,92,246,0.16))' : 'transparent',
                            border: active ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
                            boxShadow: active ? '0 2px 14px rgba(99,102,241,0.18)' : 'none',
                        }}>
                            <div style={{ fontSize: 17, marginBottom: 3 }}>{t.icon}</div>
                            <div style={{
                                fontSize: 10, fontWeight: active ? 700 : 500,
                                color: active ? '#c4b5fd' : 'rgba(255,255,255,0.38)',
                                letterSpacing: 0.2,
                            }}>{t.label}</div>
                        </button>
                    );
                })}
            </div>

            {/* ── PORTFOLIO tab ── */}
            {tab === 'portfolio' && (
                <div>
                    {/* Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 8, fontSize: 14,
                            background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>📊</div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Portföy Haberleri</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>varlıklarınızla ilgili son gelişmeler</div>
                        </div>
                    </div>

                    {loadingPortfolio && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <SkeletonCard wide />
                            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    )}
                    {!loadingPortfolio && portfolioNews.length === 0 && assets.length === 0 && (
                        <EmptyState icon="📂" text={'Portföy haberleri için önce varlık ekleyin.'} />
                    )}
                    {!loadingPortfolio && portfolioNews.length === 0 && assets.length > 0 && (
                        <EmptyState icon="🔍" text={'Haberler bulunamadı. Birazdan tekrar deneyin.'} />
                    )}
                    {!loadingPortfolio && portfolioNews.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {portfolioNews.slice(0, 1).map((a, i) => (
                                <ArticleCard key={i} article={a} featured accent="#a78bfa" />
                            ))}
                            {portfolioNews.slice(1, 9).map((a, i) => (
                                <ArticleCard key={i + 1} article={a} accent="#a78bfa" />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── GLOBAL tab ── */}
            {tab === 'global' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 8, fontSize: 14,
                            background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>🌍</div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Global Ekonomi</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>dünya piyasalarından önemli gündem</div>
                        </div>
                    </div>

                    {loadingGlobal && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <SkeletonCard wide />
                            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    )}
                    {!loadingGlobal && globalNews.length === 0 && (
                        <EmptyState icon="📡" text={'Global haberler yüklenemedi. İnternet bağlantınızı kontrol edin.'} />
                    )}
                    {!loadingGlobal && globalNews.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {globalNews.slice(0, 1).map((a, i) => (
                                <ArticleCard key={i} article={a} featured accent="#60a5fa" />
                            ))}
                            {globalNews.slice(1, 10).map((a, i) => (
                                <ArticleCard key={i + 1} article={a} accent="#60a5fa" />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── SEARCH tab ── */}
            {tab === 'search' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 8, fontSize: 14,
                            background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>🔎</div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Varlık Ara</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>herhangi bir varlık

 hakkında haber bul</div>
                        </div>
                    </div>

                    {/* Search input */}
                    <div style={{
                        display: 'flex', gap: 8, marginBottom: 20,
                        background: 'rgba(255,255,255,0.04)', borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.08)', padding: '4px 4px 4px 14px',
                        transition: 'border-color 0.2s',
                    }} onFocus={() => {}} onBlur={() => {}}>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Örn: Apple, Bitcoin, Dolar, Altın..."
                            style={{
                                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                color: '#fff', fontSize: 13, padding: '8px 0',
                            }}
                        />
                        <button
                            onClick={handleSearch}
                            disabled={!searchQuery.trim() || loadingSearch}
                            style={{
                                padding: '10px 16px', borderRadius: 10,
                                background: searchQuery.trim()
                                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                    : 'rgba(255,255,255,0.07)',
                                color: searchQuery.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                                border: 'none', cursor: searchQuery.trim() ? 'pointer' : 'not-allowed',
                                fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                                flexShrink: 0,
                            }}
                        >
                            {loadingSearch ? '...' : 'Ara'}
                        </button>
                    </div>

                    {/* Quick asset chips — user's portfolio */}
                    {assets.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
                                Portföyünüzden
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                                {assets.slice(0, 8).map(asset => {
                                    const cat = getCategoryMeta(asset.category);
                                    return (
                                        <button
                                            key={asset.id}
                                            onClick={() => { setSearchQuery(asset.name); fetchNews(`${asset.name} ${asset.category === 'stock' ? 'hisse borsa' : asset.category === 'crypto' ? 'kripto' : asset.category === 'gold' ? 'altın' : 'kur'} haber`, setSearchNews, setLoadingSearch); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '7px 12px', borderRadius: 50,
                                                background: 'rgba(255,255,255,0.05)',
                                                border: `1px solid ${cat.color}44`,
                                                color: 'rgba(255,255,255,0.7)', fontSize: 11,
                                                fontWeight: 600, cursor: 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <span style={{ fontSize: 13 }}>{cat.icon}</span>
                                            <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {asset.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Search results */}
                    {loadingSearch && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    )}
                    {!loadingSearch && searchNews.length === 0 && !searchQuery && (
                        <EmptyState icon="🔍" text={'Bir varlık adı veya anahtar kelime girin.\nÖrn: Tesla, Ethereum, Dolar...'}/>
                    )}
                    {!loadingSearch && searchNews.length === 0 && searchQuery && (
                        <EmptyState icon="😕" text={`"${searchQuery}" için haber bulunamadı.`} />
                    )}
                    {!loadingSearch && searchNews.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{searchNews.length} sonuç:</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>{searchQuery}</span>
                            </div>
                            {searchNews.slice(0, 1).map((a, i) => (
                                <ArticleCard key={i} article={a} featured accent="#34d399" />
                            ))}
                            {searchNews.slice(1, 10).map((a, i) => (
                                <ArticleCard key={i + 1} article={a} accent="#34d399" />
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
