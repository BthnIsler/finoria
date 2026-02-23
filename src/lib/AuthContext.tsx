'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedName = localStorage.getItem('finoria_display_name');
        if (savedName) setDisplayName(savedName);

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (!session?.user) {
                setDisplayName('');
                localStorage.removeItem('finoria_display_name');
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (username: string, password: string) => {
        const cleanName = username.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
        if (!cleanName) throw new Error('Geçerli bir kullanıcı adı girin.');

        const email = `${cleanName}@finoria.app`; // Dummy email for Supabase

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            throw new Error('Giriş başarısız. Kullanıcı adı veya şifre hatalı.');
        }

        setDisplayName(username);
        localStorage.setItem('finoria_display_name', username);
    };

    const register = async (username: string, password: string) => {
        const cleanName = username.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
        if (!cleanName) throw new Error('Geçerli bir kullanıcı adı girin.');
        if (password.length < 6) throw new Error('Şifre en az 6 karakter olmalıdır.');

        const email = `${cleanName}@finoria.app`; // Dummy email for Supabase

        const { error: signUpError } = await supabase.auth.signUp({ email, password });

        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                throw new Error('Bu kullanıcı adı zaten alınmış. Lütfen başka bir tane deneyin.');
            }
            throw new Error(`Kayıt başarısız: ${signUpError.message}`);
        }

        // After successful signup, user should be automatically signed in by Supabase
        setDisplayName(username);
        localStorage.setItem('finoria_display_name', username);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setDisplayName('');
        localStorage.removeItem('finoria_display_name');
    };

    return (
        <AuthContext.Provider value={{ user, displayName, loading, login, register, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
