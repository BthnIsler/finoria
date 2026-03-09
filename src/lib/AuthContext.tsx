'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// ── Detect if Supabase is properly configured ─────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const IS_SUPABASE_CONFIGURED =
    SUPABASE_URL.length > 0 &&
    !SUPABASE_URL.includes('dummy') &&
    !SUPABASE_URL.includes('placeholder') &&
    SUPABASE_URL.startsWith('https://');

// ── Minimal "User" shape we use in local mode ─────────────────────────────
export interface LocalUser {
    id: string;
    email: string;
}

interface AuthContextType {
    user: LocalUser | null;
    displayName: string;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    displayName: '',
    loading: true,
    login: async () => { },
    register: async () => { },
    signOut: async () => { },
});

// ── localStorage helpers ──────────────────────────────────────────────────
const LS_USER_KEY = 'finoria_local_user';
const LS_ACCOUNTS_KEY = 'finoria_accounts';

interface LocalAccount {
    username: string;
    passwordHash: string; // simple hash for local only
}

function simpleHash(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return h.toString(36);
}

function getAccounts(): Record<string, LocalAccount> {
    try { return JSON.parse(localStorage.getItem(LS_ACCOUNTS_KEY) || '{}'); } catch { return {}; }
}
function saveAccounts(accounts: Record<string, LocalAccount>) {
    localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<LocalUser | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (IS_SUPABASE_CONFIGURED) {
            // Real Supabase path
            import('./supabase').then(async ({ supabase }) => {
                const savedName = localStorage.getItem('finoria_display_name');
                if (savedName) setDisplayName(savedName);

                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const sUser = session?.user;
                    setUser(sUser ? { id: sUser.id, email: sUser.email ?? '' } : null);
                } catch (err) {
                    console.error('Auth getSession error:', err);
                }
                setLoading(false);

                const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                    const sUser = session?.user;
                    setUser(sUser ? { id: sUser.id, email: sUser.email ?? '' } : null);
                    if (!session?.user) {
                        setDisplayName('');
                        localStorage.removeItem('finoria_display_name');
                    }
                    setLoading(false);
                });

                return () => subscription.unsubscribe();
            });
        } else {
            // Local-only path
            const savedUser = localStorage.getItem(LS_USER_KEY);
            if (savedUser) {
                try {
                    const u = JSON.parse(savedUser) as LocalUser;
                    setUser(u);
                    setDisplayName(u.id); // id == username in local mode
                } catch { /* ignore */ }
            }
            setLoading(false);
        }
    }, []);

    // ── Login ──────────────────────────────────────────────────────────────
    const login = async (username: string, password: string) => {
        const cleanName = username.toLowerCase().replace(/\s+/g, '').trim();
        if (!cleanName) throw new Error('Geçerli bir kullanıcı adı girin.');

        if (!IS_SUPABASE_CONFIGURED) {
            // Local auth
            const accounts = getAccounts();
            const account = accounts[cleanName];
            if (!account) throw new Error('Bu kullanıcı adı bulunamadı. Önce kayıt olun.');
            if (account.passwordHash !== simpleHash(password)) throw new Error('Şifre hatalı.');

            const localUser: LocalUser = { id: cleanName, email: `${cleanName}@finoria.local` };
            setUser(localUser);
            setDisplayName(username);
            localStorage.setItem(LS_USER_KEY, JSON.stringify(localUser));
            localStorage.setItem('finoria_display_name', username);
            return;
        }

        // Supabase auth
        const { supabase } = await import('./supabase');
        const email = `${cleanName}@finoria.app`;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error('Giriş başarısız. Kullanıcı adı veya şifre hatalı.');
        setDisplayName(username);
        localStorage.setItem('finoria_display_name', username);
    };

    // ── Register ───────────────────────────────────────────────────────────
    const register = async (username: string, password: string) => {
        const cleanName = username.toLowerCase().replace(/\s+/g, '').trim();
        if (!cleanName) throw new Error('Geçerli bir kullanıcı adı girin.');
        if (password.length < 6) throw new Error('Şifre en az 6 karakter olmalıdır.');

        if (!IS_SUPABASE_CONFIGURED) {
            // Local registration
            const accounts = getAccounts();
            if (accounts[cleanName]) throw new Error('Bu kullanıcı adı zaten alınmış. Başka bir tane deneyin.');
            accounts[cleanName] = { username, passwordHash: simpleHash(password) };
            saveAccounts(accounts);

            const localUser: LocalUser = { id: cleanName, email: `${cleanName}@finoria.local` };
            setUser(localUser);
            setDisplayName(username);
            localStorage.setItem(LS_USER_KEY, JSON.stringify(localUser));
            localStorage.setItem('finoria_display_name', username);
            return;
        }

        // Supabase registration
        const { supabase } = await import('./supabase');
        const email = `${cleanName}@finoria.app`;
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
            if (signUpError.message.includes('already registered')) throw new Error('Bu kullanıcı adı zaten alınmış.');
            throw new Error(`Kayıt başarısız: ${signUpError.message}`);
        }
        setDisplayName(username);
        localStorage.setItem('finoria_display_name', username);
    };

    // ── Sign out ───────────────────────────────────────────────────────────
    const signOut = async () => {
        if (IS_SUPABASE_CONFIGURED) {
            const { supabase } = await import('./supabase');
            await supabase.auth.signOut();
        }
        setUser(null);
        setDisplayName('');
        localStorage.removeItem(LS_USER_KEY);
        localStorage.removeItem('finoria_display_name');
    };

    return (
        <AuthContext.Provider value={{ user, displayName, loading, login, register, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
