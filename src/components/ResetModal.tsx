'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

interface ResetModalProps {
    onClose: () => void;
    onReset: () => void;
}

export default function ResetModal({ onClose, onReset }: ResetModalProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: warning, 2: password confirm, 3: done
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirmReset = async () => {
        if (!user?.email || !password) return;
        setLoading(true);
        setError(null);

        try {
            // Re-authenticate user with password
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password,
            });

            if (authError) {
                setError('Şifre yanlış. Lütfen tekrar deneyin.');
                setLoading(false);
                return;
            }

            // Delete all user data
            const { error: assetsError } = await supabase
                .from('assets')
                .delete()
                .eq('user_id', user.id);

            if (assetsError) {
                console.error('Assets delete error:', assetsError);
            }

            const { error: historyError } = await supabase
                .from('wealth_history')
                .delete()
                .eq('user_id', user.id);

            if (historyError) {
                console.error('History delete error:', historyError);
            }

            setStep(3);
            setTimeout(() => {
                onReset();
                onClose();
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Beklenmeyen bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-secondary)', borderRadius: 24,
                maxWidth: 420, width: '92%', overflow: 'hidden',
                border: '1px solid var(--border)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
            }} onClick={(e) => e.stopPropagation()}>
                {/* Red danger bar */}
                <div style={{
                    height: 4, background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)',
                }} />

                {step === 1 && (
                    <div style={{ padding: 28 }}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                                Her Şeyi Sıfırla
                            </h2>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                Bu işlem tüm varlıklarınızı, servet geçmişinizi ve portföy verilerinizi
                                <strong style={{ color: 'var(--accent-red)' }}> kalıcı olarak silecektir</strong>.
                                Bu işlem geri alınamaz.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={onClose} style={{
                                flex: 1, padding: '12px', borderRadius: 12,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                                cursor: 'pointer',
                            }}>
                                Vazgeç
                            </button>
                            <button onClick={() => setStep(2)} style={{
                                flex: 1, padding: '12px', borderRadius: 12,
                                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                                border: 'none', color: 'white', fontSize: 13, fontWeight: 700,
                                cursor: 'pointer',
                            }}>
                                Devam Et
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div style={{ padding: 28 }}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                                Şifrenizi Doğrulayın
                            </h2>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Güvenlik için hesap şifrenizi girin
                            </p>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                                fontSize: 12, color: 'var(--text-muted)',
                            }}>
                                📧 {user?.email}
                            </div>
                            <input
                                type="password"
                                placeholder="Şifreniz"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                                style={{
                                    width: '100%', padding: '12px 14px', borderRadius: 10,
                                    background: 'var(--bg-elevated)', border: '2px solid var(--border)',
                                    color: 'var(--text-primary)', fontSize: 14,
                                    outline: 'none',
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmReset()}
                            />
                        </div>

                        {error && (
                            <div style={{
                                background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)',
                                borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                                color: 'var(--accent-red)', fontSize: 12,
                            }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => { setStep(1); setError(null); setPassword(''); }} style={{
                                flex: 1, padding: '12px', borderRadius: 12,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                                cursor: 'pointer',
                            }}>
                                Geri
                            </button>
                            <button
                                onClick={handleConfirmReset}
                                disabled={!password || loading}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12,
                                    background: password && !loading
                                        ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                                        : 'var(--bg-elevated)',
                                    border: 'none',
                                    color: password && !loading ? 'white' : 'var(--text-muted)',
                                    fontSize: 13, fontWeight: 700,
                                    cursor: password && !loading ? 'pointer' : 'not-allowed',
                                    opacity: password && !loading ? 1 : 0.5,
                                }}
                            >
                                {loading ? '⏳ Siliniyor...' : '🗑 Sıfırla'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                            Tüm Veriler Silindi
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Portföyünüz sıfırlandı. Sayfa yenileniyor...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
