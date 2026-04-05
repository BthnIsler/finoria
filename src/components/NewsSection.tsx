'use client';

import React, { useState, useCallback, useRef } from 'react';
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

const buildAssetQuery = (asset: Asset) => {
    return asset.name; // Sadece adını kullanarak haberlerin çıkmasını sağlıyoruz (yanına hisse borsa ekleyince arama bozuluyor)
};

const GLOBAL_QUERY = 'küresel ekonomi piyasa merkez bankası faiz döviz borsa dünya ekonomisi';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.025)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.05)', padding: '14px 16px',
            animation: 'skPulse 1.5s ease-in-out infinite',
        }}>
            <div style={{ height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.07)', width: '85%', marginBottom: 10 }} />
            <div style={{ height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.05)', width: '60%', marginBottom: 10 }} />
            <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)', width: '40%' }} />
            <style>{`@keyframes skPulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
        </div>
    );
}

// ─── Article card ─────────────────────────────────────────────────────────────
function ArticleCard({ article, accent = '#a78bfa', featured = false }: {
    article: NewsArticle; accent?: string; featured?: boolean;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <a 
            href={article.link} 
            onClick={(e) => {
                e.preventDefault();
                window.open(article.link, '_blank');
            }}
            style={{ textDecoration: 'none', display: 'block' }}
        >
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    background: hovered ? 'rgba(255,255,255,0.06)' : (featured ? `${accent}0d` : 'rgba(255,255,255,0.025)'),
                    borderRadius: featured ? 20 : 15,
                    border: `1px solid ${hovered ? `${accent}55` : (featured ? `${accent}35` : 'rgba(255,255,255,0.07)')}`,
                    padding: featured ? '16px 18px' : '12px 14px',
                    transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                }}
            >
                <div style={{
                    position: 'absolute', left: 0, top: 15, bottom: 15, width: 3,
                    borderRadius: '0 3px 3px 0',
                    background: `linear-gradient(180deg, ${accent}, ${accent}44)`,
                }} />
                <div style={{ paddingLeft: 10 }}>
                    {featured && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: `${accent}20`, border: `1px solid ${accent}40`,
                            borderRadius: 20, padding: '2px 9px', marginBottom: 8,
                        }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent, animation: 'blip 1.2s ease-in-out infinite' }} />
                            <span style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: 0.8, textTransform: 'uppercase' }}>Öne Çıkan</span>
                        </div>
                    )}
                    <p style={{
                        fontSize: featured ? 13 : 12.5, fontWeight: featured ? 700 : 600,
                        color: 'rgba(255,255,255,0.9)', lineHeight: 1.55, margin: '0 0 8px',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{article.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{
                            fontSize: 9.5, fontWeight: 700, color: accent,
                            background: `${accent}18`, border: `1px solid ${accent}2a`,
                            padding: '2px 8px', borderRadius: 20, lineHeight: 1.8,
                        }}>{article.source || 'Haber'}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>{formatDate(article.pubDate)}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 13, color: `${accent}66` }}>↗</span>
                    </div>
                </div>
                <style>{`@keyframes blip{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
            </div>
        </a>
    );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.25)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{text}</p>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewsSection({ assets }: NewsSectionProps) {
    const [tab, setTab] = useState<Tab>('portfolio');

    // Portfolio tab: per-asset news
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [assetNews, setAssetNews]         = useState<NewsArticle[]>([]);
    const [assetLoading, setAssetLoading]   = useState(false);

    // Global tab
    const [globalNews, setGlobalNews]       = useState<NewsArticle[]>([]);
    const [globalLoading, setGlobalLoading] = useState(false);
    const globalFetched = useRef(false);

    // Search tab
    const [searchQuery, setSearchQuery]     = useState('');
    const [searchNews, setSearchNews]       = useState<NewsArticle[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const cache = useRef<Record<string, NewsArticle[]>>({});

    const fetchNews = useCallback(async (
        q: string,
        setter: (a: NewsArticle[]) => void,
        setLoading: (b: boolean) => void,
    ) => {
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

    // Load global news when switching to global tab
    const handleTabChange = useCallback((t: Tab) => {
        setTab(t);
        if (t === 'global' && !globalFetched.current) {
            globalFetched.current = true;
            fetchNews(GLOBAL_QUERY, setGlobalNews, setGlobalLoading);
        }
    }, [fetchNews]);

    // Select an asset in portfolio tab
    const handleSelectAsset = useCallback((asset: Asset) => {
        if (selectedAsset?.id === asset.id) return; // already selected
        setSelectedAsset(asset);
        const q = buildAssetQuery(asset);
        fetchNews(q, setAssetNews, setAssetLoading);
    }, [selectedAsset, fetchNews]);

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
                        <button key={t.key} onClick={() => handleTabChange(t.key)} style={{
                            flex: 1, padding: '10px 4px', borderRadius: 14,
                            cursor: 'pointer', transition: 'all 0.2s',
                            background: active ? 'linear-gradient(135deg,rgba(99,102,241,0.28),rgba(139,92,246,0.16))' : 'transparent',
                            border: active ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
                            boxShadow: active ? '0 2px 14px rgba(99,102,241,0.18)' : 'none',
                        }}>
                            <div style={{ fontSize: 16, marginBottom: 3 }}>{t.icon}</div>
                            <div style={{
                                fontSize: 10, fontWeight: active ? 700 : 500,
                                color: active ? '#c4b5fd' : 'rgba(255,255,255,0.38)',
                            }}>{t.label}</div>
                        </button>
                    );
                })}
            </div>

            {/* ── PORTFOLIO tab: asset list + per-asset news ── */}
            {tab === 'portfolio' && (
                <div>
                    {assets.length === 0 && (
                        <EmptyState icon="📂" text="Portföy haberleri için önce varlık ekleyin." />
                    )}
                    {assets.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Asset list */}
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 4px' }}>
                                Varlık seçerek haber görüntüleyin
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {assets.map(asset => {
                                    const cat = getCategoryMeta(asset.category);
                                    const isActive = selectedAsset?.id === asset.id;
                                    return (
                                        <div key={asset.id}>
                                            <button
                                                onClick={() => handleSelectAsset(asset)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '12px 14px', borderRadius: 14,
                                                background: isActive
                                                    ? `linear-gradient(135deg, ${cat.color}22, ${cat.color}0a)`
                                                    : 'rgba(255,255,255,0.03)',
                                                border: isActive
                                                    ? `1px solid ${cat.color}44`
                                                    : '1px solid rgba(255,255,255,0.07)',
                                                transition: 'all 0.2s', cursor: 'pointer',
                                                textAlign: 'left',
                                                boxShadow: isActive ? `0 4px 16px ${cat.color}16` : 'none',
                                            }}
                                        >
                                            {/* Icon */}
                                            <div style={{
                                                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                                background: `${cat.color}18`, border: `1px solid ${cat.color}30`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 18,
                                            }}>{cat.icon}</div>
                                            {/* Name + category */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: 13, fontWeight: 700,
                                                    color: isActive ? cat.color : 'rgba(255,255,255,0.85)',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>{asset.name}</div>
                                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                                    {cat.labelTR}
                                                </div>
                                            </div>
                                            {/* Active indicator */}
                                            <span style={{
                                                fontSize: 14, color: isActive ? cat.color : 'rgba(255,255,255,0.15)',
                                                transition: 'transform 0.2s',
                                                transform: isActive ? 'translateX(0)' : 'translateX(-4px)',
                                            }}>›</span>
                                            </button>
                                            
                                            {/* Accordion Content for Active Asset */}
                                            {isActive && (
                                                <div style={{ marginTop: 8, padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
                                                    {/* Section label */}
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12
                                                    }}>
                                                        <span style={{ fontSize: 16 }}>{cat.icon}</span>
                                                        <div>
                                                            <span style={{ fontSize: 13, fontWeight: 800, color: cat.color }}>
                                                                {asset.name}
                                                            </span>
                                                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>
                                                                · son haberler
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {assetLoading && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                                                        </div>
                                                    )}
                                                    {!assetLoading && assetNews.length === 0 && (
                                                        <EmptyState icon="😕" text={`${asset.name} için haber bulunamadı.`} />
                                                    )}
                                                    {!assetLoading && assetNews.length > 0 && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                                            {assetNews.slice(0, 1).map((a, i) => (
                                                                <ArticleCard key={i} article={a} featured accent={cat.color} />
                                                            ))}
                                                            {assetNews.slice(1).map((a, i) => (
                                                                <ArticleCard key={i + 1} article={a} accent={cat.color} />
                                                            ))}
                                                        </div>
                                                    )}
                                        </div>
                                    );
                                })}
                            </div>
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
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Global Ekonomi</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>dünya piyasalarından önemli gündem</div>
                        </div>
                    </div>
                    {globalLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    )}
                    {!globalLoading && globalNews.length === 0 && (
                        <EmptyState icon="📡" text="Global haberler yüklenemedi." />
                    )}
                    {!globalLoading && globalNews.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                            {globalNews.slice(0, 1).map((a, i) => <ArticleCard key={i} article={a} featured accent="#60a5fa" />)}
                            {globalNews.slice(1).map((a, i) => <ArticleCard key={i + 1} article={a} accent="#60a5fa" />)}
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
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Varlık Ara</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>herhangi bir varlık hakkında haber bul</div>
                        </div>
                    </div>

                    {/* Search input */}
                    <div style={{
                        display: 'flex', gap: 8, marginBottom: 20,
                        background: 'rgba(255,255,255,0.04)', borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '4px 4px 4px 14px',
                    }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && searchQuery.trim()) {
                                    fetchNews(`${searchQuery.trim()} haber piyasa`, setSearchNews, setSearchLoading);
                                }
                            }}
                            placeholder="Örn: Apple, Bitcoin, Dolar, Altın..."
                            style={{
                                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                color: 'var(--text-primary)', fontSize: 13, padding: '8px 0',
                            }}
                        />
                        <button
                            onClick={() => {
                                if (searchQuery.trim()) {
                                    fetchNews(`${searchQuery.trim()} haber piyasa`, setSearchNews, setSearchLoading);
                                }
                            }}
                            disabled={!searchQuery.trim() || searchLoading}
                            style={{
                                padding: '10px 16px', borderRadius: 10,
                                background: searchQuery.trim()
                                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                    : 'rgba(255,255,255,0.07)',
                                color: searchQuery.trim() ? 'var(--text-primary)' : 'rgba(255,255,255,0.3)',
                                border: 'none', cursor: searchQuery.trim() ? 'pointer' : 'not-allowed',
                                fontSize: 12, fontWeight: 700, transition: 'all 0.2s', flexShrink: 0,
                            }}
                        >{searchLoading ? '...' : 'Ara'}</button>
                    </div>

                    {!searchLoading && searchNews.length === 0 && !searchQuery && (
                        <EmptyState icon="🔍" text={'Bir varlık adı veya anahtar kelime girin.\nÖrn: Tesla, Ethereum, Dolar...'} />
                    )}
                    {searchLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    )}
                    {!searchLoading && searchNews.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                            <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{searchNews.length} sonuç:</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>{searchQuery}</span>
                            </div>
                            {searchNews.slice(0, 1).map((a, i) => <ArticleCard key={i} article={a} featured accent="#34d399" />)}
                            {searchNews.slice(1).map((a, i) => <ArticleCard key={i + 1} article={a} accent="#34d399" />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
