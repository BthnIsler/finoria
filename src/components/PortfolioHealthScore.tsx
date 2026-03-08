'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Asset, getCategoryMeta } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';
import { getAssetCostInTRY } from '@/lib/utils';

interface HealthScoreProps {
    assets: Asset[];
    totalWealth: number;
    totalCost: number;
}

interface ScoreResult {
    score: number;
    grade: string;
    color: string;
    summary: string;
    insights: string[];
}

function computeScore(assets: Asset[], totalWealth: number, totalCost: number, exchangeRates: Record<string, number>): ScoreResult {
    if (assets.length === 0) {
        return {
            score: 0, grade: '—', color: '#6b7280',
            summary: 'Portföy boş. Varlık ekleyerek başlayın.',
            insights: [],
        };
    }

    let score = 60; // base
    const insights: string[] = [];

    // ── 1. Diversification (0–20 pts)
    const categories = new Set(assets.map(a => a.category));
    const catCount = categories.size;
    if (catCount >= 4) {
        score += 20;
        insights.push('✅ Harika çeşitlilik: ' + catCount + ' farklı kategoride yatırım var');
    } else if (catCount === 3) {
        score += 12;
        insights.push('🟡 İyi çeşitlilik: Biraz daha kategori ekleyebilirsiniz');
    } else if (catCount === 2) {
        score += 6;
        insights.push('⚠️ Sınırlı çeşitlilik: Sadece 2 kategoride yatırım var');
    } else {
        insights.push('🔴 Risk yüksek: Tüm paranız tek kategoride');
    }

    // ── 2. Concentration risk — no single asset > 60% (0–10 pts)
    let maxConc = 0;
    let maxConcName = '';
    assets.forEach(a => {
        const val = a.amount * (a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice);
        const pct = totalWealth > 0 ? (val / totalWealth) * 100 : 0;
        if (pct > maxConc) { maxConc = pct; maxConcName = a.name; }
    });
    if (maxConc < 30) {
        score += 10;
        insights.push('✅ Dengeli dağılım: Hiçbir varlık %30\'dan fazla pay almıyor');
    } else if (maxConc < 50) {
        score += 5;
        insights.push(`🟡 ${maxConcName} portföyün %${maxConc.toFixed(0)}'ini oluşturuyor`);
    } else {
        insights.push(`🔴 ${maxConcName} portföyün %${maxConc.toFixed(0)}'ini oluşturuyor — yüksek konsantrasyon riski`);
    }

    // ── 3. P/L overall (0–10 pts)
    const totalPL = totalWealth - totalCost;
    const plPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    if (plPct > 20) {
        score += 10;
        insights.push(`✅ Toplam karlılık güçlü: +%${plPct.toFixed(1)}`);
    } else if (plPct > 0) {
        score += 5;
        insights.push(`🟡 Pozitif getiri: +%${plPct.toFixed(1)}`);
    } else if (plPct < -20) {
        score -= 5;
        insights.push(`🔴 Dikkat: Portföy toplam -%${Math.abs(plPct).toFixed(1)} zararda`);
    } else {
        insights.push(`🟡 Getiri düşük: %${plPct.toFixed(1)}`);
    }

    // ── 4. Asset count (0–5 pts)
    if (assets.length >= 5) {
        score += 5;
    } else if (assets.length >= 3) {
        score += 3;
        insights.push('💡 Daha fazla varlık ekleyerek portföyü büyütebilirsiniz');
    } else {
        insights.push('💡 Portföyde az sayıda varlık var');
    }

    // Clamp
    score = Math.min(100, Math.max(0, score));

    let grade = 'F';
    let color = '#ef4444';
    let summary = '';

    if (score >= 85) { grade = 'A'; color = '#10b981'; summary = 'Mükemmel! Portföyünüz çok sağlıklı görünüyor.'; }
    else if (score >= 70) { grade = 'B'; color = '#22d3ee'; summary = 'İyi durumda. Küçük iyileştirmelerle daha da güçlenebilir.'; }
    else if (score >= 55) { grade = 'C'; color = '#f59e0b'; summary = 'Orta. Çeşitlendirme yapmanız önerilir.'; }
    else if (score >= 40) { grade = 'D'; color = '#f97316'; summary = 'Dikkat. Portföy dengesizliği var.'; }
    else { grade = 'F'; color = '#ef4444'; summary = 'Risk yüksek. Portföyünüzü yeniden değerlendirin.'; }

    return { score, grade, color, summary, insights };
}

export default function PortfolioHealthScore({ assets, totalWealth, totalCost }: HealthScoreProps) {
    const { exchangeRates } = useCurrency();
    const [open, setOpen] = useState(false);

    const result = computeScore(assets, totalWealth, totalCost, exchangeRates);

    // Animated score display
    const [displayScore, setDisplayScore] = useState(0);
    useEffect(() => {
        const target = result.score;
        const duration = 1000;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplayScore(Math.round(target * eased));
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [result.score]);

    // SVG arc for score ring
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (result.score / 100) * circumference;

    return (
        <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 14,
            border: `1px solid ${result.color}28`,
            overflow: 'hidden',
        }}>
            {/* Header Row */}
            <div
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', cursor: 'pointer',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Score Ring */}
                    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                        <svg width="56" height="56" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                            <circle
                                cx="40" cy="40" r={radius} fill="none"
                                stroke={result.color} strokeWidth="7"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
                            />
                        </svg>
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{ fontSize: 14, fontWeight: 900, color: result.color, lineHeight: 1 }}>
                                {displayScore}
                            </span>
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                Portföy Sağlıkı
                            </span>
                            <span style={{
                                fontSize: 12, fontWeight: 800, color: result.color,
                                background: `${result.color}18`,
                                padding: '1px 7px', borderRadius: 5,
                            }}>
                                {result.grade}
                            </span>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                            {result.summary}
                        </p>
                    </div>
                </div>

                <span style={{
                    fontSize: 14, color: 'var(--text-muted)',
                    transition: 'transform 0.2s',
                    transform: open ? 'rotate(180deg)' : 'rotate(0)',
                }}>▼</span>
            </div>

            {/* Expanded Insights */}
            {open && result.insights.length > 0 && (
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    padding: '12px 16px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                    {result.insights.map((insight, i) => (
                        <div key={i} style={{
                            fontSize: 11, color: 'var(--text-secondary)',
                            lineHeight: 1.5, padding: '4px 0',
                            borderBottom: i < result.insights.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}>
                            {insight}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
