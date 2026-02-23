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
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(false);

    // For 'asset' tab: which asset is expanded, which is selected for news
    const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [assetArticles, setAssetArticles] = useState<NewsArticle[]>([]);
    const [assetLoading, setAssetLoading] = useState(false);

    const buildQuery = useCallback((tab: NewsTab) => {
        if (tab === 'market') {
            return 'borsa ekonomi piyasa haberleri';
        }
        // portfolio: combine all asset names 
        const categories = [...new Set(assets.map(a => a.category))];
        const parts: string[] = [];
        assets.slice(0, 5).forEach(a => parts.push(a.name));
        if (categories.includes('stock')) parts.push('borsa hisse');
        if (categories.includes('crypto')) parts.push('kripto');
        if (categories.includes('gold')) parts.push('altın');
        return parts.join(' OR ');
    }, [assets]);

    // Fetch market/portfolio news whenever tab or open state changes
    useEffect(() => {
        if (!isOpen || activeTab === 'asset') return;
        if (assets.length === 0 && activeTab === 'portfolio') return;

        const fetchNews = async () => {
            setLoading(true);
            try {
                const query = buildQuery(activeTab);
                const res = await fetch(`/api/news?q=${encodeURIComponent(query)}&period=1w`);
                const data = await res.json();
                setArticles(data.articles || []);
            } catch {
                setArticles([]);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [isOpen, activeTab, buildQuery, assets.length]);

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

                    {/* Tab content */}
                    {activeTab !== 'asset' ? (
                        <ArticleList articles={articles} loading={loading} />
                    ) : (
                        /* Yatırımlarım: asset list, each expandable to show news */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {assets.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Henüz varlık eklenmedi.</p>
                            ) : assets.map((asset) => {
                                const cat = getCategoryMeta(asset.category);
                                const isExpanded = expandedAssets.has(asset.id);
                                const isSelected = selectedAssetId === asset.id;
                                return (
                                    <div key={asset.id} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        {/* Asset row — click to toggle */}
                                        <button
                                            onClick={() => toggleAsset(asset)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '10px 14px', background: isExpanded ? 'var(--bg-elevated)' : 'transparent',
                                                border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                                            }}
                                            onMouseOver={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                                            onMouseOut={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div style={{
                                                width: 30, height: 30, borderRadius: 8,
                                                background: `${cat.color}18`, border: `1px solid ${cat.color}28`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                                            }}>
                                                {cat.icon}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                                                <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                                    {asset.name}
                                                </p>
                                                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.labelTR}</p>
                                            </div>
                                            <span style={{
                                                fontSize: 16, color: 'var(--text-muted)',
                                                transition: 'transform 0.2s',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                            }}>⌄</span>
                                        </button>

                                        {/* News for this asset */}
                                        <div style={{
                                            maxHeight: isExpanded ? '800px' : '0px',
                                            overflow: 'hidden',
                                            transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
                                            borderTop: isExpanded ? '1px solid var(--border)' : 'none',
                                        }}>
                                            <div style={{ padding: '8px 8px 8px' }}>
                                                <ArticleList
                                                    articles={isSelected ? assetArticles : []}
                                                    loading={isSelected ? assetLoading : false}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </WidgetWrapper>
    );
}
