'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Goal {
    id: string;
    title: string;
    reward: string;
    emoji: string;
    target: number;
    createdAt: string;
}

interface ProfileViewProps {
    totalWealth: number;
    fmt: (n: number) => string;
    username?: string;
    onSignOut?: () => void;
    theme?: string;
    toggleTheme?: () => void;
    goals?: Goal[];
    isMobile?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'finoria_goals_v2';

const loadGoals = (): Goal[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};
const saveGoals = (goals: Goal[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
};

const EMOJIS = ['🏖️', '📱', '✈️', '🏠', '🚗', '💎', '🎯', '🎓', '💰', '🌟', '🛍️', '🎁', '🏋️', '🎸', '🛳️', '🌴', '🍾', '🤝', '🏆', '💻'];

// Progress bar
function GoalProgress({ current, target, color }: { current: number; target: number; color: string }) {
    const pct = Math.min(100, (current / target) * 100);
    const done = current >= target;
    return (
        <div style={{ position: 'relative', height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${pct}%`, borderRadius: 8,
                background: done
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : `linear-gradient(90deg, ${color}, ${color}cc)`,
                boxShadow: done ? '0 0 8px rgba(16,185,129,0.6)' : `0 0 8px ${color}66`,
                transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
        </div>
    );
}

// An individual goal card
function GoalCard({
    goal, current, fmt, onDelete,
}: {
    goal: Goal; current: number; fmt: (n: number) => string; onDelete: (id: string) => void;
}) {
    const pct = Math.min(100, (current / goal.target) * 100);
    const done = current >= goal.target;
    const remaining = goal.target - current;
    const color = done ? '#10b981' : '#8b5cf6';

    return (
        <div style={{
            background: done
                ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.04))'
                : 'rgba(255,255,255,0.03)',
            borderRadius: 20, border: done ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.07)',
            padding: '20px', position: 'relative', overflow: 'hidden',
            transition: 'all 0.3s',
        }}>
            {/* Completion celebration overlay */}
            {done && (
                <div style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                    borderRadius: 20, padding: '4px 12px',
                    fontSize: 10, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5,
                }}>✓ TAMAMLANDI</div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: done
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.12))'
                        : 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.12))',
                    border: done ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(139,92,246,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26,
                }}>{goal.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
                        {goal.title}
                    </div>
                    <div style={{
                        fontSize: 11, color: done ? '#6ee7b7' : '#c4b5fd',
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <span>🎁</span> {goal.reward}
                    </div>
                </div>
                <button
                    onClick={() => onDelete(goal.id)}
                    style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none',
                        background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)',
                        cursor: 'pointer', fontSize: 14, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                >×</button>
            </div>

            {/* Progress */}
            <GoalProgress current={current} target={goal.target} color={color} />

            {/* Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color }}>
                    {pct.toFixed(0)}%
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                    {done
                        ? '🎉 Hedefe ulaştın!'
                        : `${fmt(remaining)} kaldı`}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                    {fmt(goal.target)} hedef
                </div>
            </div>
        </div>
    );
}

// Add goal modal/form
function AddGoalForm({ onAdd, onClose }: { onAdd: (g: Omit<Goal, 'id' | 'createdAt'>) => void; onClose: () => void }) {
    const [title, setTitle] = useState('');
    const [reward, setReward] = useState('');
    const [target, setTarget] = useState('');
    const [emoji, setEmoji] = useState('🏆');
    const [showEmojis, setShowEmojis] = useState(false);

    const canSubmit = title.trim() && reward.trim() && Number(target) > 0;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'flex-end',
        }} onClick={onClose}>
            <div
                style={{
                    width: '100%', background: '#111827',
                    borderRadius: '24px 24px 0 0',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '24px 20px 40px',
                    boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
                    animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }} />

                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 20px', textAlign: 'center' }}>
                    Yeni Hedef Ekle 🎯
                </h3>

                {/* Emoji selector */}
                <div style={{ marginBottom: 16 }}>
                    <button
                        type="button"
                        onClick={() => setShowEmojis(v => !v)}
                        style={{
                            width: 60, height: 60, borderRadius: 16,
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.15))',
                            border: '1px solid rgba(139,92,246,0.3)',
                            fontSize: 30, cursor: 'pointer', display: 'block', margin: '0 auto',
                        }}
                    >{emoji}</button>
                    {showEmojis && (
                        <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: 6,
                            background: '#1f2937', borderRadius: 14, padding: 12, marginTop: 8,
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                            {EMOJIS.map(em => (
                                <button
                                    key={em} type="button"
                                    onClick={() => { setEmoji(em); setShowEmojis(false); }}
                                    style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: emoji === em ? 'rgba(139,92,246,0.3)' : 'transparent',
                                        border: emoji === em ? '1px solid rgba(139,92,246,0.5)' : '1px solid transparent',
                                        fontSize: 22, cursor: 'pointer',
                                    }}
                                >{em}</button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Fields */}
                {[
                    { label: 'Hedef başlığı', val: title, set: setTitle, ph: 'Örn: İlk Evim, Macbook...', type: 'text' },
                    { label: 'Ödülüm', val: reward, set: setReward, ph: 'Örn: Kendime telefon alacağım 📱', type: 'text' },
                    { label: 'Portföy hedefi (₺)', val: target, set: setTarget, ph: 'Örn: 500000', type: 'number' },
                ].map(f => (
                    <div key={f.label} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                            {f.label}
                        </label>
                        <input
                            type={f.type}
                            value={f.val}
                            onChange={e => f.set(e.target.value)}
                            placeholder={f.ph}
                            inputMode={f.type === 'number' ? 'numeric' : 'text'}
                            style={{
                                width: '100%', padding: '12px 16px',
                                background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                                fontSize: 14, outline: 'none', boxSizing: 'border-box',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.6)')}
                            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                        />
                    </div>
                ))}

                <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => {
                        if (!canSubmit) return;
                        onAdd({ title: title.trim(), reward: reward.trim(), target: Number(target), emoji });
                        onClose();
                    }}
                    style={{
                        width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                        background: canSubmit
                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                            : 'rgba(255,255,255,0.07)',
                        color: canSubmit ? 'var(--text-primary)' : 'rgba(255,255,255,0.3)',
                        fontSize: 15, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed',
                        boxShadow: canSubmit ? '0 8px 24px rgba(99,102,241,0.4)' : 'none',
                        transition: 'all 0.2s',
                        marginTop: 4,
                    }}
                >
                    🎯 Hedefi Kaydet
                </button>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); } to { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

// ─── Main ProfileView ─────────────────────────────────────────────────────────
export default function ProfileView({
    username, totalWealth, goals: initialGoals, fmt, onSignOut, theme, toggleTheme, isMobile = true
}: ProfileViewProps) {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [activeSection, setActiveSection] = useState<'goals' | 'profile'>('goals');
    const [notificationsOn, setNotificationsOn] = useState(true);

    useEffect(() => { setGoals(loadGoals()); }, []);

    const addGoal = useCallback((g: Omit<Goal, 'id' | 'createdAt'>) => {
        const newGoal: Goal = { ...g, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        const updated = [...goals, newGoal];
        setGoals(updated); saveGoals(updated);
    }, [goals]);

    const deleteGoal = useCallback((id: string) => {
        const updated = goals.filter(g => g.id !== id);
        setGoals(updated); saveGoals(updated);
    }, [goals]);

    // Sort: incomplete first, then completed
    const sortedGoals = [
        ...goals.filter(g => totalWealth < g.target),
        ...goals.filter(g => totalWealth >= g.target),
    ];

    const completedCount = goals.filter(g => totalWealth >= g.target).length;
    const initials = (username ?? 'U').slice(0, 1).toUpperCase();

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 120, paddingTop: 48 }}>

            {/* ── Profile hero ── */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
                borderRadius: 24, border: '1px solid rgba(99,102,241,0.2)',
                padding: '24px 20px', marginBottom: 20, textAlign: 'center',
            }}>
                {/* Avatar */}
                <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 900, color: 'var(--text-primary)',
                    margin: '0 auto 12px',
                    boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
                    border: '3px solid rgba(255,255,255,0.15)',
                }}>{initials}</div>

                <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                    {username ?? 'Kullanıcı'}
                </h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px' }}>
                    Finoria Premium Üyesi
                </p>

                {/* Stats strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                        { label: 'Toplam\nServet', value: fmt(totalWealth), color: '#a78bfa' },
                        { label: 'Hedef\nSayısı', value: String(goals.length), color: '#60a5fa' },
                        { label: 'Tamamlanan\nHedef', value: String(completedCount), color: '#34d399' },
                    ].map(s => (
                        <div key={s.label} style={{
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: 14, padding: '12px 8px',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginBottom: 4 }}>
                                {s.value}
                            </div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Section tabs ── */}
            <div style={{
                display: 'flex', gap: 0, marginBottom: 20,
                background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4,
                border: '1px solid rgba(255,255,255,0.06)',
            }}>
                {[
                    { key: 'goals' as const, label: '🎯 Hedeflerim' },
                    { key: 'profile' as const, label: '⚙️ Profil' },
                ].map(s => (
                    <button
                        key={s.key}
                        onClick={() => setActiveSection(s.key)}
                        style={{
                            flex: 1, padding: '10px', borderRadius: 10,
                            cursor: 'pointer', fontSize: 13, fontWeight: 700,
                            background: activeSection === s.key
                                ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))'
                                : 'transparent',
                            color: activeSection === s.key ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                            border: activeSection === s.key ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                            transition: 'all 0.2s',
                        }}
                    >{s.label}</button>
                ))}
            </div>

            {/* ── Goals section ── */}
            {activeSection === 'goals' && (
                <div>
                    {/* Header + Add button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>
                                Finansal Hedeflerim
                            </h3>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                                Servetine göre ilerlemeyi takip et
                            </p>
                        </div>
                        <button
                            onClick={() => setShowAdd(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '10px 16px', borderRadius: 12, border: 'none',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: 'var(--text-primary)', fontSize: 13, fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                            }}
                        >
                            <span style={{ fontSize: 16 }}>+</span> Hedef Ekle
                        </button>
                    </div>

                    {/* Empty state */}
                    {goals.length === 0 && (
                        <div
                            style={{
                                textAlign: 'center', padding: '48px 24px',
                                background: 'rgba(255,255,255,0.02)', borderRadius: 20,
                                border: '1px dashed rgba(255,255,255,0.1)',
                            }}
                        >
                            <div style={{ fontSize: 52, marginBottom: 16 }}>🎯</div>
                            <h4 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                                İlk hedefinizi belirleyin
                            </h4>
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: '0 0 24px' }}>
                                Portföy büyüdükçe kendinize ödüller koyun.<br />
                                500.000₺ = Telefon, 2.000.000₺ = Tatil...
                            </p>
                            <button
                                onClick={() => setShowAdd(true)}
                                style={{
                                    padding: '12px 28px', borderRadius: 14, border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                                    boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                                }}
                            >🚀 İlk Hedefi Ekle</button>
                        </div>
                    )}

                    {/* Goal cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {sortedGoals.map(goal => (
                            <GoalCard
                                key={goal.id} goal={goal}
                                current={totalWealth} fmt={fmt}
                                onDelete={deleteGoal}
                            />
                        ))}
                    </div>

                    {/* Motivational tip */}
                    {goals.length > 0 && completedCount < goals.length && (
                        <div style={{
                            marginTop: 20,
                            background: 'rgba(99,102,241,0.08)', borderRadius: 16,
                            border: '1px solid rgba(99,102,241,0.2)', padding: '14px 16px',
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <span style={{ fontSize: 20 }}>💡</span>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
                                En yakın hedefinize ulaşmak için
                                <strong style={{ color: '#c4b5fd' }}> {fmt(sortedGoals[0].target - totalWealth)} </strong>
                                daha gerekiyor.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Profile settings section ── */}
            {activeSection === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                        { 
                          id: 'theme', icon: '🌙', title: 'Tema', 
                          value: theme === 'light' ? 'Açık Mod' : 'Koyu Mod', 
                          sub: 'Uygulama görünümü değiştin',
                          onClick: toggleTheme 
                        },
                        { 
                          id: 'notif', icon: '🔔', title: 'Bildirimler', 
                          value: notificationsOn ? 'Açık' : 'Kapalı', 
                          sub: 'Önemli uyarılar',
                          onClick: () => setNotificationsOn(!notificationsOn)
                        },
                        { id: 'curr', icon: '💱', title: 'Para Birimi', value: 'TRY', sub: 'Türk Lirası', hideInWeb: true },
                        { id: 'sec', icon: '🔒', title: 'Güvenlik', value: 'Aktif', sub: 'Uygulama kilidi', hideInWeb: true },
                        { id: 'data', icon: '📊', title: 'Veri Yönetimi', value: 'Yerel', sub: 'Cihazda saklanır' },
                    ].filter(item => isMobile || !item.hideInWeb).map(item => (
                        <div 
                          key={item.id} 
                          onClick={item.onClick}
                          style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              background: 'rgba(255,255,255,0.03)', borderRadius: 16,
                              border: '1px solid rgba(255,255,255,0.06)', padding: '16px',
                              cursor: item.onClick ? 'pointer' : 'default',
                              transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => { if(item.onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                          onMouseLeave={(e) => { if(item.onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12, fontSize: 18,
                                    background: 'rgba(255,255,255,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{item.icon}</div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{item.sub}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>{item.value}</span>
                                {item.onClick && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>›</span>}
                            </div>
                        </div>
                    ))}

                    {/* Sign-out button */}
                    {onSignOut && (
                        <button
                            onClick={onSignOut}
                            style={{
                                marginTop: 12, padding: '16px', borderRadius: 16, border: 'none',
                                background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'all 0.2s',
                            }}
                        >
                            <span style={{ fontSize: 18 }}>🚪</span> Çıkış Yap
                        </button>
                    )}

                    {/* App version */}
                    <div style={{ textAlign: 'center', padding: '16px', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                        Finoria v1.0 · Versiyon
                    </div>
                </div>
            )}

            {/* ── Add goal modal ── */}
            {showAdd && <AddGoalForm onAdd={addGoal} onClose={() => setShowAdd(false)} />}
        </div>
    );
}
