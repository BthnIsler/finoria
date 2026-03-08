'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/lib/contexts';

interface Goal {
    id: string;
    label: string;
    targetAmount: number; // TRY
    emoji: string;
    createdAt: string;
}

const GOAL_PRESETS = [
    { label: 'İlk 1 Milyon TL', targetAmount: 1_000_000, emoji: '💎' },
    { label: '500 Bin TL', targetAmount: 500_000, emoji: '🏅' },
    { label: 'Araba Peşinatı', targetAmount: 400_000, emoji: '🚗' },
    { label: 'Ev Peşinatı', targetAmount: 2_000_000, emoji: '🏡' },
    { label: 'Emeklilik Fonu', targetAmount: 5_000_000, emoji: '🌴' },
    { label: 'Acil Durum Fonu', targetAmount: 150_000, emoji: '🛡️' },
];

const STORAGE_KEY = 'finoria_goals';

function loadGoals(): Goal[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
}

function saveGoals(goals: Goal[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

interface GoalTrackerProps {
    totalWealth: number; // TRY
}

export default function GoalTracker({ totalWealth }: GoalTrackerProps) {
    const { convert, currency } = useCurrency();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [customLabel, setCustomLabel] = useState('');
    const [customAmount, setCustomAmount] = useState('');
    const [customEmoji, setCustomEmoji] = useState('🎯');

    useEffect(() => {
        setGoals(loadGoals());
    }, []);

    const addGoal = (label: string, targetAmount: number, emoji: string) => {
        const newGoal: Goal = {
            id: Date.now().toString(),
            label, targetAmount, emoji,
            createdAt: new Date().toISOString(),
        };
        const updated = [...goals, newGoal];
        setGoals(updated);
        saveGoals(updated);
        setShowAdd(false);
        setCustomLabel(''); setCustomAmount(''); setCustomEmoji('🎯');
    };

    const removeGoal = (id: string) => {
        const updated = goals.filter(g => g.id !== id);
        setGoals(updated);
        saveGoals(updated);
    };

    const fmt = (n: number) => new Intl.NumberFormat('tr-TR', {
        style: 'currency', currency,
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n);

    if (goals.length === 0 && !showAdd) {
        return (
            <div style={{
                padding: '14px 16px',
                background: 'var(--bg-elevated)', borderRadius: 14,
                border: '1px dashed rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12,
            }}>
                <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>🎯 Hedef Belirle</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Finansal bir hedef koy ve ilerlemeyi takip et</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="btn-primary"
                    style={{ padding: '7px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
                >
                    ＋ Hedef Ekle
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Goal Cards */}
            {goals.map(goal => {
                const currentDisplay = convert(totalWealth);
                const targetDisplay = convert(goal.targetAmount);
                const pct = Math.min((totalWealth / goal.targetAmount) * 100, 100);
                const isAchieved = totalWealth >= goal.targetAmount;
                const remaining = Math.max(goal.targetAmount - totalWealth, 0);

                return (
                    <div
                        key={goal.id}
                        style={{
                            padding: '14px 16px',
                            background: 'var(--bg-elevated)',
                            borderRadius: 14,
                            border: isAchieved
                                ? '1px solid rgba(16,185,129,0.3)'
                                : '1px solid var(--border)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Glow on achieved */}
                        {isAchieved && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(16,185,129,0.08), transparent)',
                                pointerEvents: 'none',
                            }} />
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 20 }}>{goal.emoji}</span>
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {goal.label}
                                        {isAchieved && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-green)', fontWeight: 800 }}>✓ ULAŞILDI!</span>}
                                    </p>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {isAchieved
                                            ? `Tebrikler! Hedefi aştınız.`
                                            : `${fmt(convert(remaining))} kaldı`}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                    fontSize: 13, fontWeight: 800,
                                    color: isAchieved ? 'var(--accent-green)' : 'var(--accent-purple)',
                                }}>
                                    {pct.toFixed(1)}%
                                </span>
                                <button
                                    onClick={() => removeGoal(goal.id)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: 14, color: 'var(--text-muted)', padding: '2px 4px',
                                        opacity: 0.5, transition: 'opacity 0.2s',
                                    }}
                                    onMouseOver={e => e.currentTarget.style.opacity = '1'}
                                    onMouseOut={e => e.currentTarget.style.opacity = '0.5'}
                                    title="Hedefi sil"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{
                            height: 6, borderRadius: 4,
                            background: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${pct}%`,
                                borderRadius: 4,
                                background: isAchieved
                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                    : 'linear-gradient(90deg, var(--accent-purple), var(--accent-cyan))',
                                transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                                boxShadow: isAchieved
                                    ? '0 0 8px rgba(16,185,129,0.5)'
                                    : '0 0 8px rgba(139,92,246,0.4)',
                            }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                Şu an: {fmt(currentDisplay)}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                                Hedef: {fmt(targetDisplay)}
                            </span>
                        </div>
                    </div>
                );
            })}

            {/* Add Goal Area */}
            {showAdd ? (
                <div style={{
                    padding: '16px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                }}>
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Hızlı Hedefler</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {GOAL_PRESETS.map(p => (
                            <button
                                key={p.label}
                                onClick={() => addGoal(p.label, p.targetAmount, p.emoji)}
                                style={{
                                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--accent-purple)'; }}
                                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                {p.emoji} {p.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Özel Hedef</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="text" placeholder="Emoji" value={customEmoji}
                                onChange={e => setCustomEmoji(e.target.value)}
                                style={{
                                    width: 48, padding: '8px', borderRadius: 8, fontSize: 18,
                                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', textAlign: 'center', outline: 'none',
                                }}
                            />
                            <input
                                type="text" placeholder="Hedef adı"
                                value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                                style={{
                                    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none',
                                }}
                            />
                            <input
                                type="number" placeholder="Tutar (TRY)"
                                value={customAmount} onChange={e => setCustomAmount(e.target.value)}
                                style={{
                                    width: 120, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none',
                                }}
                            />
                            <button
                                onClick={() => {
                                    const amt = parseFloat(customAmount);
                                    if (customLabel.trim() && amt > 0) {
                                        addGoal(customLabel.trim(), amt, customEmoji || '🎯');
                                    }
                                }}
                                className="btn-primary"
                                style={{ padding: '8px 16px', fontSize: 12 }}
                            >
                                Ekle
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAdd(false)}
                        style={{
                            marginTop: 10, fontSize: 11, color: 'var(--text-muted)',
                            background: 'none', border: 'none', cursor: 'pointer',
                        }}
                    >
                        İptal
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowAdd(true)}
                    style={{
                        padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        background: 'transparent',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--accent-purple)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    ＋ Yeni Hedef Ekle
                </button>
            )}
        </div>
    );
}
