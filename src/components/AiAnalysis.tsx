'use client';

import React, { useState } from 'react';
import { Asset } from '@/lib/types';

interface AiAnalysisProps {
    asset: Asset;
    onClose: () => void;
}

export default function AiAnalysis({ asset, onClose }: AiAnalysisProps) {
    const [analysis, setAnalysis] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchAnalysis = async () => {
        setLoading(true);
        setError('');
        try {
            const symbol = asset.apiId?.includes(':') ? asset.apiId.split(':')[1] : asset.apiId;
            const res = await fetch('/api/ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assetName: asset.name,
                    assetCategory: asset.category,
                    symbol: symbol || asset.name,
                }),
            });

            if (!res.ok) throw new Error('API hatası');
            const data = await res.json();
            setAnalysis(data.analysis);
        } catch {
            setError('AI analizi alınamadı. Lütfen tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch on mount
    React.useEffect(() => {
        fetchAnalysis();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                {/* Header */}
                <div style={{
                    padding: '24px 28px 18px',
                    borderBottom: '1px solid var(--border)',
                    position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-cyan), transparent)',
                        borderRadius: '24px 24px 0 0',
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                                fontSize: 28,
                                width: 44, height: 44,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(34,211,238,0.1))',
                                borderRadius: 14,
                            }}>🤖</span>
                            <div>
                                <h2 style={{ fontSize: 16, fontWeight: 700 }}>AI Analiz</h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{asset.name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-icon" style={{ borderRadius: '50%' }}>✕</button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px 28px 28px' }}>
                    {loading ? (
                        <div style={{
                            textAlign: 'center', padding: '40px 20px',
                        }}>
                            <div style={{
                                width: 48, height: 48, margin: '0 auto 16px',
                                border: '3px solid var(--border)',
                                borderTopColor: 'var(--accent-purple)',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }} />
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                AI analizi hazırlanıyor...
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4, opacity: 0.6 }}>
                                Groq LLM ile analiz ediliyor
                            </p>
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                            <p style={{ color: 'var(--accent-red)', fontSize: 14, marginBottom: 16 }}>{error}</p>
                            <button onClick={fetchAnalysis} className="btn-secondary" style={{ fontSize: 13 }}>
                                🔄 Tekrar Dene
                            </button>
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                            {analysis.split('\n').map((line, i) => {
                                // Highlight section headers (lines starting with emoji)
                                const isHeader = /^[📊📈🔮💡🌐⚠️]/.test(line.trim());
                                if (!line.trim()) return <br key={i} />;
                                return (
                                    <p key={i} style={{
                                        marginBottom: 6,
                                        fontWeight: isHeader ? 600 : 400,
                                        color: isHeader ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontSize: isHeader ? 14 : 13,
                                    }}>
                                        {line}
                                    </p>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer with refresh */}
                    {!loading && !error && analysis && (
                        <div style={{
                            marginTop: 20, paddingTop: 16,
                            borderTop: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                Groq AI · llama-3.3-70b
                            </span>
                            <button onClick={fetchAnalysis} className="btn-secondary" style={{ fontSize: 11, padding: '6px 14px' }}>
                                🔄 Yenile
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
