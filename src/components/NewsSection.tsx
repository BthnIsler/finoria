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

export default function NewsSection({ assets }: NewsSectionProps) {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<string>('');

    // Build unique asset names for the filter chips
    const assetNames = assets.map((a) => a.name).filter((name, i, arr) => arr.indexOf(name) === i);

    useEffect(() => {
        if (assets.length === 0) return;
        // Auto-select the first asset
        if (!selectedAsset && assetNames.length > 0) {
            setSelectedAsset(assetNames[0]);
        }
    }, [assets, assetNames, selectedAsset]);

    useEffect(() => {
        if (!selectedAsset) return;

        const fetchNews = async () => {
            setLoading(true);
            try {
                // Find the asset object to get more details if needed
                const asset = assets.find(a => a.name === selectedAsset);
                let query = selectedAsset;

                // Create a more specific search query
                if (asset) {
                    if (asset.category === 'stock' && asset.apiId) {
                        // For stocks: "AAPL hisse haberleri", "THYAO hisse haberleri"
                        const symbol = asset.apiId.split(':')[1] || asset.apiId;
                        query = `${symbol} hisse haberleri ${asset.name}`;
                    } else if (asset.category === 'crypto' && asset.apiId) {
                        // For crypto: "Bitcoin haberleri", "BTC haberleri"
                        query = `${asset.name} kripto haberleri`;
                    } else if (asset.category === 'forex') {
                        query = `${asset.name} piyasa haberleri`;
                    } else {
                        query = `${asset.name} haberleri`;
                    }
                }

                const res = await fetch(`/api/news?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                setArticles(data.articles || []);
            } catch {
                setArticles([]);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [selectedAsset, assets]);

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

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p className="section-title" style={{ marginBottom: 0 }}>📰 Haberler</p>
            </div>

            {/* Asset filter chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
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
                        {selectedAsset ? `"${selectedAsset}" için haber bulunamadı` : 'Varlık seçerek haberleri görüntüleyin'}
                    </p>
                </div>
            )}
        </div>
    );
}
