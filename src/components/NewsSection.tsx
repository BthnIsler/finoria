'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, getCategoryMeta } from '@/lib/types';

interface NewsArticle {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

interface NewsSectionProps {
    assets: Asset[];
}

const formatDate = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffH = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
        if (diffH < 1) return 'Az önce';
        if (diffH < 24) return `${diffH}s`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `${diffD}g`;
        return date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
    } catch { return ''; }
};

// Skeleton loader card
function SkeletonCard() {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)', padding: '16px 18px',
            animation: 'skeletonPulse 1.4s ease-in-out infinite',
        }}>
            <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', width: '80%', marginBottom: 10 }} />
            <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '55%' }} />
            <style>{`@keyframes skeletonPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
    );
}

// Premium article card
function ArticleCard({ article, accent }: { article: NewsArticle; accent?: string }) {
    const color = accent ?? '#a78bfa';
    return (
        <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'block' }}
        >
            <div
                style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '14px 16px', cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative', overflow: 'hidden',
                }}
                onMouseOver={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.borderColor = `${color}44`;
                }}
                onMouseOut={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                }}
            >
                {/* Left accent bar */}
                <div style={{
                    position: 'absolute', left: 0, top: 16, bottom: 16,
                    width: 3, borderRadius: '0 3px 3px 0',
                    background: `linear-gradient(180deg, ${color}, ${color}44)`,
                }} />
                <div style={{ paddingLeft: 8 }}>
                    <p style={{
                        fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)',
                        lineHeight: 1.5, margin: '0 0 8px',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{article.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, color,
                            background: `${color}18`, border: `1px solid ${color}30`,
                            padding: '2px 8px', borderRadius: 20, lineHeight: 1.8,
                        }}>{article.source || 'Haber'}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                            {formatDate(article.pubDate)}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>↗</span>
                    </div>
                </div>
            </div>
        </a>
    );
}

// Breaking global news card (larger, highlighted)
function BreakingCard({ article }: { article: NewsArticle }) {
    return (
        <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
            <div
                style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
                    borderRadius: 18, border: '1px solid rgba(239,68,68,0.25)',
                    padding: '18px 20px', cursor: 'pointer',
                    transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                }}
                onMouseOver={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.5)'}
                onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.25)'}
            >
                {/* Breaking badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: '#ef4444', borderRadius: 6,
                    padding: '3px 9px', marginBottom: 10,
                }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#fff', animation: 'breakingDot 1s ease-in-out infinite',
                    }} />
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                        Önemli Gelişme
                    </span>
                </div>
                <p style={{
                    fontSize: 14, fontWeight: 700, color: '#fff',
                    lineHeight: 1.55, margin: '0 0 10px',
                    display: '-webkit-box', WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{article.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>{article.source || 'Global'}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{formatDate(article.pubDate)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 14, color: 'rgba(239,68,68,0.7)' }}>↗</span>
                </div>
                <style>{`@keyframes breakingDot { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
            </div>
        </a>
    );
}

export default function NewsSection({ assets }: NewsSectionProps) {
    type Tab = 'global' | 'portfolio' | 'asset';
    const [activeTab, setActiveTab] = useState<Tab>('portfolio');
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [assetArticles, setAssetArticles] = useState<NewsArticle[]>([]);
    const [assetLoading, setAssetLoading] = useState(false);
    const cacheRef = useRef<Record<string, NewsArticle[]>>({});

    const fetchNews = useCallback(async (query: string, key: string, setter: (a: NewsArticle[]) => void, setL: (b: boolean) => void) => {
        if (cacheRef.current[key]) { setter(cacheRef.current[key]); return; }
        setL(true);
        try {
            const res = await fetch(`/api/news?q=${encodeURIComponent(query)}&period=1w`);
            const data = await res.json();
            const result = data.articles || [];
            cacheRef.current[key] = result;
            setter(result);
        } catch { setter([]); }
        finally { setL(false); }
    }, []);

    useEffect(() => {
        if (activeTab === 'asset') return;
        const key = activeTab;
        const query = activeTab === 'global'
            ? 'global economy major event market crash breaking'
            : assets.map(a => a.name).slice(0, 6).join(' OR ') + ' borsa kripto altın döviz';
        if (query) fetchNews(query, key, setArticles, setLoading);
    }, [activeTab, assets, fetchNews]);

    const handleSelectAsset = (asset: Asset) => {
        if (selectedAsset?.id === asset.id) { setSelectedAsset(null); return; }
        setSelectedAsset(asset);
        const cat = getCategoryMeta(asset.category);
        let q = asset.name;
        if (asset.category === 'stock') q = `${asset.name} hisse`;
        if (asset.category === 'crypto') q = `${asset.name} kripto`;
        if (asset.category === 'forex') q = `${asset.name} kur`;
        if (asset.category === 'gold') q = `${asset.name} altın`;
        fetchNews(q, `asset-${asset.id}`, setAssetArticles, setAssetLoading);
        void cat;
    };

    const TABS: { key: Tab; label: string; icon: string; desc: string }[] = [
        { key: 'portfolio', label: 'Portföyüm', icon: '📊', desc: 'Varlıklarınıza özel' },
        { key: 'global', label: 'Dünya', icon: '🌍', desc: 'Önemli gelişmeler' },
        { key: 'asset', label: 'Varlık', icon: '🔎', desc: 'Varlık bazlı' },
    ];

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* ── Tab bar ── */}
            <div style={{
                display: 'flex', gap: 8, marginBottom: 20, padding: '4px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.06)',
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            flex: 1, padding: '10px 6px', borderRadius: 14,
                            cursor: 'pointer', transition: 'all 0.2s',
                            background: activeTab === tab.key
                                ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))'
                                : 'transparent',
                            boxShadow: activeTab === tab.key ? '0 2px 12px rgba(99,102,241,0.2)' : 'none',
                            border: activeTab === tab.key ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                        }}
                    >
                        <div style={{ fontSize: 16, marginBottom: 3 }}>{tab.icon}</div>
                        <div style={{
                            fontSize: 11, fontWeight: activeTab === tab.key ? 700 : 500,
                            color: activeTab === tab.key ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                        }}>{tab.label}</div>
                    </button>
                ))}
            </div>

            {/* ── Portfolio tab ── */}
            {activeTab === 'portfolio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {loading
                        ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                        : articles.length === 0
                            ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Haber bulunamadı</div>
                            : articles.slice(0, 8).map((a, i) => (
                                <ArticleCard key={i} article={a} accent="#a78bfa" />
                            ))
                    }
                </div>
            )}

            {/* ── Global tab ── */}
            {activeTab === 'global' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                        padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                    }}>
                        <span style={{ fontSize: 13 }}>⚠️</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                            Yalnızca küresel çaplı <strong style={{ color: 'rgba(255,255,255,0.8)' }}>çok önemli</strong> gelişmeler gösterilir
                        </span>
                    </div>
                    {loading
                        ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                        : articles.length === 0
                            ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Önemli gelişme bulunamadı</div>
                            : articles.slice(0, 5).map((a, i) =>
                                i === 0
                                    ? <BreakingCard key={i} article={a} />
                                    : <ArticleCard key={i} article={a} accent="#ef4444" />
                            )
                    }
                </div>
            )}

            {/* ── Asset tab ── */}
            {activeTab === 'asset' && (
                <div>
                    {/* Asset selector chips */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
                    }}>
                        {assets.length === 0
                            ? <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Önce varlık ekleyin</p>
                            : assets.map(asset => {
                                const cat = getCategoryMeta(asset.category);
                                const isActive = selectedAsset?.id === asset.id;
                                return (
                                    <button
                                        key={asset.id}
                                        onClick={() => handleSelectAsset(asset)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '8px 14px', borderRadius: 50,
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            background: isActive
                                                ? `linear-gradient(135deg, ${cat.color}40, ${cat.color}20)`
                                                : 'rgba(255,255,255,0.05)',
                                            border: isActive ? `1.5px solid ${cat.color}66` : '1.5px solid rgba(255,255,255,0.08)',
                                            color: isActive ? cat.color : 'rgba(255,255,255,0.55)',
                                            fontSize: 12, fontWeight: isActive ? 700 : 500,
                                            boxShadow: isActive ? `0 4px 16px ${cat.color}22` : 'none',
                                        }}
                                    >
                                        <span style={{ fontSize: 14 }}>{cat.icon}</span>
                                        <span style={{
                                            maxWidth: 90, overflow: 'hidden',
                                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>{asset.name}</span>
                                    </button>
                                );
                            })
                        }
                    </div>

                    {/* News for selected asset */}
                    {selectedAsset && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                            }}>
                                <span style={{ fontSize: 14 }}>{getCategoryMeta(selectedAsset.category).icon}</span>
                                <span style={{
                                    fontSize: 13, fontWeight: 700,
                                    color: getCategoryMeta(selectedAsset.category).color,
                                }}>{selectedAsset.name}</span>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>· Son haberler</span>
                            </div>
                            {assetLoading
                                ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                                : assetArticles.length === 0
                                    ? <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                                        Bu varlık için haber bulunamadı
                                    </div>
                                    : assetArticles.slice(0, 7).map((a, i) => (
                                        <ArticleCard
                                            key={i} article={a}
                                            accent={getCategoryMeta(selectedAsset.category).color}
                                        />
                                    ))
                            }
                        </div>
                    )}

                    {!selectedAsset && assets.length > 0 && (
                        <div style={{
                            textAlign: 'center', padding: '28px 0',
                            color: 'rgba(255,255,255,0.2)', fontSize: 13,
                        }}>
                            Haber görmek için bir varlık seçin ↑
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
