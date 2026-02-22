'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useDesignTheme } from '@/lib/contexts';

export default function AuthModal({ onClose }: { onClose?: () => void }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { design } = useDesignTheme();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('Kayıt başarılı! Lütfen e-postanızı kontrol ederek hesabınızı doğrulayın (Eğer Supabase email gönderimi açıksa). Sisteme giriş yapabilirsiniz.');
                setIsLogin(true);
            }
            if (onClose) onClose();
        } catch (err: any) {
            setError(err.message || 'Bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 400 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</h2>
                    {onClose && (
                        <button onClick={onClose} className="btn-icon" style={{ padding: 4, width: 28, height: 28 }}>
                            ✕
                        </button>
                    )}
                </div>

                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: 'var(--text-secondary)' }}>E-posta</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                width: '100%', padding: '12px', borderRadius: 12,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontSize: 14, outline: 'none'
                            }}
                            placeholder="ornek@email.com"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: 'var(--text-secondary)' }}>Şifre</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '12px', borderRadius: 12,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontSize: 14, outline: 'none'
                            }}
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{ padding: '12px', marginTop: 8, fontSize: 14, fontWeight: 600 }}
                    >
                        {loading ? 'İşleniyor...' : isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                    {isLogin ? 'Hesabınız yok mu?' : 'Zaten hesabınız var mı?'}
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(null); }}
                        style={{
                            background: 'none', border: 'none',
                            color: 'var(--accent-purple)', fontWeight: 600,
                            marginLeft: 6, cursor: 'pointer'
                        }}
                    >
                        {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
                    </button>
                </div>
            </div>
        </div>
    );
}
