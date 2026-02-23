'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Asset, getCategoryMeta } from '@/lib/types';
import WidgetWrapper from '@/components/WidgetWrapper';

interface NewsArticle {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

interface NewsSectionProps {
    assets: Asset[];
}

type NewsTab = 'market' | 'portfolio' | 'asset';
type TimeFilter = '1d' | '1w' | '1m' | 'all';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
    { key: '1d', label: '1 Gün' },
    { key: '1w', label: '1 Hafta' },
    { key: '1m', label: '1 Ay' },
    { key: 'all', label: 'Tümü' },
];

const formatDate = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffH = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
        if (diffH < 1) return 'Az önce';
        if (diffH < 24) return `${diffH} saat önce`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `${diffD} gün önce`;
        return date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
    } catch { return ''; }
};

function ArticleList({ articles, loading }: { articles: NewsArticle[]; loading: boolean }) {
    if (loading) return (
        <div style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Haberler yükleniyor...</p>
        </div>
    );
    if (articles.length === 0) return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Haber bulunamadı.</p>
        </div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {articles.slice(0, 10).map((article, i) => (
                <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        transition: 'background 0.15s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <div style={{ minWidth: 0 }}>
                        <p style={{
                            fontSize: 13, fontWeight: 500, lineHeight: 1.5,
                            color: 'var(--text-primary)',
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                            {article.title}
                        </p>
                        <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                            {article.source && (
                                <>
                                    <span style={{ color: 'var(--accent-purple)', fontWeight: 500 }}>{article.source}</span>
                                    <span>·</span>
                                </>
                            )}
                            <span>{formatDate(article.pubDate)}</span>
                        </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 14, flexShrink: 0, marginTop: 2 }}>↗</span>
                </a>
            ))}
        </div>
    );
}

export default function NewsSection({ assets }: NewsSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<NewsTab>('market');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('1w');
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(false);

    // For 'asset' tab: which asset is expanded, which is selected for news
    const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [assetArticles, setAssetArticles] = useState<NewsArticle[]>([]);
    const [assetLoading, setAssetLoading] = useState(false);

    const buildQuery = useCallback((tab: NewsTab) => {
        if (tab === 'market') {
            return 'borsa ekonomi piyasa bist haberleri';
        }
        // portfolio: use all asset names as search terms so results are relevant to the user's holdings
        const names = assets.map(a => a.name).slice(0, 8);
        const categories = [...new Set(assets.map(a => a.category))];
        if (categories.includes('stock')) names.push('hisse borsa');
        if (categories.includes('crypto')) names.push('kripto');
        if (categories.includes('gold')) names.push('altın');
        if (categories.includes('forex')) names.push('döviz kur');
        return names.join(' OR ');
    }, [assets]);

    // Fetch market/portfolio news whenever tab, timeFilter or open state changes
    useEffect(() => {
        if (!isOpen || activeTab === 'asset') return;
        if (assets.length === 0 && activeTab === 'portfolio') return;

        const fetchNews = async () => {
            setLoading(true);
            try {
                const query = buildQuery(activeTab);
                const period = timeFilter !== 'all' ? `&period=${timeFilter}` : '';
                const res = await fetch(`/api/news?q=${encodeURIComponent(query)}${period}`);
                const data = await res.json();
                setArticles(data.articles || []);
            } catch {
                setArticles([]);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [isOpen, activeTab, timeFilter, buildQuery, assets.length]);

    // Fetch news for a specific asset
    const fetchAssetNews = useCallback(async (asset: Asset) => {
        setSelectedAssetId(asset.id);
        setAssetLoading(true);
        try {
            let query = asset.name;
            if (asset.category === 'stock' && asset.apiId) {
                const symbol = asset.apiId.split(':')[1] || asset.apiId;
                query = `${symbol} hisse ${asset.name}`;
            } else if (asset.category === 'crypto' && asset.apiId) {
                query = `${asset.name} kripto haberleri`;
            } else if (asset.category === 'forex') {
                query = `${asset.name} kur haberleri`;
            }
            const res = await fetch(`/api/news?q=${encodeURIComponent(query)}&period=1w`);
            const data = await res.json();
            setAssetArticles(data.articles || []);
        } catch {
            setAssetArticles([]);
        } finally {
            setAssetLoading(false);
        }
    }, []);

    const toggleAsset = (asset: Asset) => {
        const next = new Set(expandedAssets);
        if (next.has(asset.id)) {
            next.delete(asset.id);
            if (selectedAssetId === asset.id) {
                setSelectedAssetId(null);
                setAssetArticles([]);
            }
        } else {
            next.add(asset.id);
            fetchAssetNews(asset);
        }
        setExpandedAssets(next);
    };

    const TABS: { key: NewsTab; icon: string; label: string }[] = [
        { key: 'market', icon: '🌍', label: 'Piyasa' },
        { key: 'portfolio', icon: '📊', label: 'Hisselerimin' },
        { key: 'asset', icon: '💼', label: 'Yatırımlarım' },
    ];

    return (
        <WidgetWrapper widgetId="news">
            <div>
                {/* Clickable header */}
                <button
                    onClick={() => setIsOpen(o => !o)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 8,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(34,211,238,0.1))',
                            border: '1px solid rgba(167,139,250,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        }}>
                            📰
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                                Haberler
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Piyasa · Portföy · Varlık bazlı
                            </span>
                        </div>
                    </div>
                    <span style={{
                        fontSize: 18, color: 'var(--text-muted)',
                        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        display: 'flex', alignItems: 'center',
                    }}>
                        ⌄
                    </span>
                </button>

                {/* Collapsible body */}
                <div style={{
                    overflow: 'hidden',
                    maxHeight: isOpen ? '3000px' : '0px',
                    opacity: isOpen ? 1 : 0,
                    transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s',
                }}>
                    <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 14px' }} />

                    {/* Tab bar */}
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '7px 14px', borderRadius: 20,
                                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                                    background: activeTab === tab.key
                                        ? 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(34,211,238,0.12))'
                                        : 'var(--bg-elevated)',
                                    color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    border: '1px solid',
                                    borderColor: activeTab === tab.key ? 'rgba(167,139,250,0.3)' : 'var(--border)',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                    {activeTab !== 'asset' && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                            {TIME_FILTERS.map(tf => (
                                <button
                                    key={tf.key}
                                    onClick={() => setTimeFilter(tf.key)}
                                    style={{
                                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                        background: timeFilter === tf.key ? 'var(--accent-purple)' : 'var(--bg-elevated)',
                                        color: timeFilter === tf.key ? 'white' : 'var(--text-muted)',
                                        border: timeFilter === tf.key ? 'none' : '1px solid var(--border)',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {tf.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab !== 'asset' ? (
                        <ArticleList articles={articles} loading={loading} />
                    ) : (
                        /* Yatırımlarım: left = asset list, right = news panel sliding in */
                        <div style={{ display: 'flex', gap: 0, minHeight: 240, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>

                            {/* Left: asset list */}
                            <div style={{
                                width: selectedAssetId ? '38%' : '100%',
                                transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
                                borderRight: selectedAssetId ? '1px solid var(--border)' : 'none',
                                overflowY: 'auto',
                                flexShrink: 0,
                            }}>
                                {assets.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>Henüz varlık eklenmedi.</p>
                                ) : assets.map((asset) => {
                                    const cat = getCategoryMeta(asset.category);
                                    const isSelected = selectedAssetId === asset.id;
                                    return (
                                        <button
                                            key={asset.id}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedAssetId(null);
                                                    setAssetArticles([]);
                                                } else {
                                                    fetchAssetNews(asset);
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '12px 14px',
                                                background: isSelected
                                                    ? `${cat.color}12`
                                                    : 'transparent',
                                                border: 'none',
                                                borderBottom: '1px solid var(--border)',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s',
                                                textAlign: 'left',
                                            }}
                                            onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                                            onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div style={{
                                                width: 28, height: 28, borderRadius: 8,
                                                background: `${cat.color}18`, border: `1px solid ${cat.color}28`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 13, flexShrink: 0,
                                            }}>
                                                {cat.icon}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <p style={{
                                                    fontSize: 12, fontWeight: 600,
                                                    color: isSelected ? cat.color : 'var(--text-primary)',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {asset.name}
                                                </p>
                                                {!selectedAssetId && (
                                                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cat.labelTR}</p>
                                                )}
                                            </div>
                                            {/* Arrow hint */}
                                            <span style={{
                                                fontSize: 12,
                                                color: isSelected ? cat.color : 'var(--text-muted)',
                                                transition: 'transform 0.2s, opacity 0.2s',
                                                opacity: isSelected ? 1 : 0.4,
                                                transform: isSelected ? 'translateX(0)' : 'translateX(-4px)',
                                            }}>›</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Right: news panel — slides in */}
                            <div style={{
                                flex: 1,
                                overflow: 'hidden',
                                opacity: selectedAssetId ? 1 : 0,
                                transform: selectedAssetId ? 'translateX(0)' : 'translateX(20px)',
                                transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
                                pointerEvents: selectedAssetId ? 'auto' : 'none',
                            }}>
                                <div style={{ padding: 12, overflowY: 'auto', height: '100%' }}>
                                    {selectedAssetId && (
                                        <ArticleList articles={assetArticles} loading={assetLoading} />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </WidgetWrapper>
    );
}
