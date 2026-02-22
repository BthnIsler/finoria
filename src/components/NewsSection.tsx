'use client';

import React, { useState, useEffect } from 'react';
import { Asset } from '@/lib/types';

interface NewsArticle {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

interface NewsSectionProps {
    assets: Asset[];
}

type TimeFilter = '1d' | '1w' | '1m' | 'all';

export default function NewsSection({ assets }: NewsSectionProps) {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<string>('__all__');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('1w');

    // Build unique asset names for the filter chips
    const assetNames = assets.map((a) => a.name).filter((name, i, arr) => arr.indexOf(name) === i);

    useEffect(() => {
        if (assets.length === 0) return;

        const fetchNews = async () => {
            setLoading(true);
            try {
                let query: string;

                if (selectedAsset === '__all__') {
                    // Build a combined query from top asset categories
                    const categories = [...new Set(assets.map(a => a.category))];
                    const queryParts: string[] = [];
                    if (categories.includes('stock')) queryParts.push('borsa hisse');
                    if (categories.includes('crypto')) queryParts.push('kripto bitcoin');
                    if (categories.includes('gold') || categories.includes('precious_metals')) queryParts.push('altın');
                    if (categories.includes('forex')) queryParts.push('döviz');
                    query = queryParts.length > 0 ? queryParts.join(' OR ') + ' yatırım' : 'yatırım piyasa haberleri';
                } else {
                    const asset = assets.find(a => a.name === selectedAsset);
                    query = selectedAsset;
                    if (asset) {
                        if (asset.category === 'stock' && asset.apiId) {
                            const symbol = asset.apiId.split(':')[1] || asset.apiId;
                            query = `${symbol} hisse haberleri ${asset.name}`;
                        } else if (asset.category === 'crypto' && asset.apiId) {
                            query = `${asset.name} kripto haberleri`;
                        } else if (asset.category === 'forex') {
                            query = `${asset.name} piyasa haberleri`;
                        } else {
                            query = `${asset.name} haberleri`;
                        }
                    }
                }

                // Add time filter to query
                const timeParam = timeFilter !== 'all' ? `&period=${timeFilter}` : '';
                const res = await fetch(`/api/news?q=${encodeURIComponent(query)}${timeParam}`);
                const data = await res.json();

                let filtered = data.articles || [];

                // Client-side time filtering
                if (timeFilter !== 'all') {
                    const now = new Date();
                    const cutoff = new Date();
                    if (timeFilter === '1d') cutoff.setDate(now.getDate() - 1);
                    else if (timeFilter === '1w') cutoff.setDate(now.getDate() - 7);
                    else if (timeFilter === '1m') cutoff.setMonth(now.getMonth() - 1);

                    filtered = filtered.filter((a: NewsArticle) => {
                        if (!a.pubDate) return true;
                        try {
                            return new Date(a.pubDate) >= cutoff;
                        } catch { return true; }
                    });
                }

                setArticles(filtered);
            } catch {
                setArticles([]);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [selectedAsset, timeFilter, assets]);

    if (assets.length === 0) return null;

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
        } catch {
            return '';
        }
    };

    const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
        { key: '1d', label: '1 Gün' },
        { key: '1w', label: '1 Hafta' },
        { key: '1m', label: '1 Ay' },
        { key: 'all', label: 'Tümü' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p className="section-title" style={{ marginBottom: 0 }}>📰 Haberler</p>
                {/* Time filter */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {TIME_FILTERS.map((tf) => (
                        <button
                            key={tf.key}
                            onClick={() => setTimeFilter(tf.key)}
                            style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
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
            </div>

            {/* Asset filter chips — "Tüm Haberler" first */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                <button
                    className={`chip ${selectedAsset === '__all__' ? 'active' : ''}`}
                    onClick={() => setSelectedAsset('__all__')}
                    style={{ fontSize: 11 }}
                >
                    📊 Tüm Haberler
                </button>
                {assetNames.map((name) => (
                    <button
                        key={name}
                        className={`chip ${selectedAsset === name ? 'active' : ''}`}
                        onClick={() => setSelectedAsset(name)}
                        style={{ fontSize: 11 }}
                    >
                        {name}
                    </button>
                ))}
            </div>

            {/* Articles */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 30 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Haberler yükleniyor...</p>
                </div>
            ) : articles.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                    {articles.map((article, i) => (
                        <a
                            key={i}
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="news-card"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                    <h4
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 500,
                                            lineHeight: 1.5,
                                            color: 'var(--text-primary)',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {article.title}
                                    </h4>
                                    <div
                                        style={{
                                            marginTop: 6,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            fontSize: 11,
                                            color: 'var(--text-muted)',
                                        }}
                                    >
                                        {article.source && (
                                            <>
                                                <span style={{ color: 'var(--accent-purple)', fontWeight: 500 }}>
                                                    {article.source}
                                                </span>
                                                <span>·</span>
                                            </>
                                        )}
                                        <span>{formatDate(article.pubDate)}</span>
                                    </div>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
                                    ↗
                                </span>
                            </div>
                        </a>
                    ))}
                </div>
            ) : (
                <div className="glass-card" style={{ padding: 30, textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {selectedAsset === '__all__' ? 'Haber bulunamadı' : `"${selectedAsset}" için haber bulunamadı`}
                    </p>
                </div>
            )}
        </div>
    );
}
