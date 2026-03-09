'use client';

import React, { useState, useEffect } from 'react';

interface LandingPageProps {
  username: string;
  password: string;
  setUsername: (v: string) => void;
  setPassword: (v: string) => void;
  isRegisterMode: boolean;
  setIsRegisterMode: (v: boolean) => void;
  loginLoading: boolean;
  loginError: string;
  onSubmit: (e: React.FormEvent) => void;
}

const FEATURES = [
  {
    tag: 'Portföy Takibi',
    title: 'Tüm varlıklarınız tek panelde',
    desc: 'Altın, kripto, hisse senedi, döviz ve daha fazlasını gerçek zamanlı takip edin. Canlı fiyatlar, K/Z hesaplaması ve portföy geçmişi — her şey tek ekranda.',
    imgSrc: '/screenshot-wealth.png',
    imgAlt: 'Servet Geçmişi Grafiği',
    bullets: ['30 sn\'de bir otomatik fiyat güncellemesi', 'Günlük / Haftalık / Yıllık P&L', 'Tüm zamanların grafiği'],
    color: '#10b981',
    icon: '📈',
  },
  {
    tag: 'Portföy Analizi',
    title: 'Portföy dağılımınızı görselleştirin',
    desc: 'Varlıklarınız kategorilere göre otomatik gruplandırılır ve interaktif pasta grafikler ile görselleştirilir. Hangi sınıfın ağırlıkta olduğunu anında görün.',
    imgSrc: '/screenshot-chart.png',
    imgAlt: 'Portföy Dağılım Grafiği',
    bullets: ['İnteraktif pasta diyagramı', 'Kategori bazlı dağılım', 'Değer ve oran bilgisi'],
    color: '#eab308',
    icon: '🥧',
  },
  {
    tag: 'Varlık Yönetimi',
    title: 'Tüm yatırımlarınızı detaylı takip edin',
    desc: 'Her varlığınızın canlı değerini, kar/zarar durumunu ve akıllı etiketlerini (Rekor, Dip, Elmas) tek listede görün. Sıralama, filtreleme ve arama ile istediğinizi anında bulun.',
    imgSrc: '/screenshot-assets.png',
    imgAlt: 'Varlıklarım Listesi',
    bullets: ['16+ varlık kategorisi', 'Akıllı badge sistemi', 'Hızlı satış & düzenleme'],
    color: '#6366f1',
    icon: '💼',
  },
  {
    tag: 'Finans Takvimi',
    title: 'Önemli tarihleri kaçırmayın',
    desc: 'TCMB faiz kararları, FED toplantıları, enflasyon verileri ve şirket bilanço günleri — hepsi geri sayımlı takvimde. Önemli olaylara hazırlıklı olun.',
    imgSrc: '/screenshot-events.png',
    imgAlt: 'Yaklaşan Finans Olayları',
    bullets: ['TCMB & FED kararları', 'NFP ve CPI verileri', 'Temettü ve bilanço günleri'],
    color: '#ef4444',
    icon: '📅',
  },
];

const STATS = [
  { value: '2.500+', label: 'Aktif Kullanıcı', icon: '👥' },
  { value: '12+', label: 'Varlık Kategorisi', icon: '🗂️' },
  { value: '7/24', label: 'Canlı Fiyat', icon: '⚡' },
  { value: '%100', label: 'Ücretsiz', icon: '🎁' },
];

const SLIDES = [
  {
    title: 'Servetinizi gerçek zamanlı görün',
    sub: 'Toplam varlığınız, kar/zarar durumunuz ve portföy dağılımı. Hepsi tek ekranda.',
    badge: '⚡ Canlı güncelleme',
    accent: '#10b981',
  },
  {
    title: 'AI asistan her an yanınızda',
    sub: 'Finoria AI portföyünüzü analiz eder, uyarılar verir ve sorularınızı yanıtlar.',
    badge: '🤖 AI Destekli',
    accent: '#6366f1',
  },
  {
    title: 'Önemli tarihleri kaçırmayın',
    sub: 'Faiz kararları, bilanço günleri ve ekonomik veriler için geri sayım takvimi.',
    badge: '📅 Takvim Takibi',
    accent: '#ef4444',
  },
];

export default function LandingPage({
  username,
  password,
  setUsername,
  setPassword,
  isRegisterMode,
  setIsRegisterMode,
  loginLoading,
  loginError,
  onSubmit,
}: LandingPageProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [visibleFeature, setVisibleFeature] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setActiveSlide((s) => (s + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[activeSlide];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#06070a',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#f8fafc',
      overflowX: 'hidden',
    }}>

      {/* ===== NAV ===== */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(6,7,10,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/finoria-ai.png" alt="Finoria" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5, background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Finoria
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase', marginTop: -2 }}>
                Servet Yönetimi
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', gap: 24 }}>
              {['Özellikler', 'Ekran Görüntüleri', 'Başlayın'].map((item, i) => (
                <a
                  key={item}
                  href={i === 0 ? '#features' : i === 1 ? '#screenshots' : '#auth-section'}
                  style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.color = '#fff')}
                  onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >
                  {item}
                </a>
              ))}
            </div>
            <button
              onClick={() => { setIsRegisterMode(false); document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{
                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.55)')}
              onMouseOut={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)')}
            >
              Giriş Yap →
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '96px 24px 80px' }}>
        {/* Background blobs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 64, alignItems: 'center', position: 'relative' }}>
          {/* Left — Headline */}
          <div>
            {/* Animated tag */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24,
              padding: '6px 14px', borderRadius: 100,
              background: `${slide.accent}18`,
              border: `1px solid ${slide.accent}33`,
              fontSize: 12, fontWeight: 700, color: slide.accent,
              transition: 'all 0.5s',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: slide.accent, animation: 'heroPulse 2s ease-in-out infinite' }} />
              {slide.badge}
            </div>

            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, letterSpacing: -2,
              lineHeight: 1.08, color: '#fff', marginBottom: 20,
              transition: 'all 0.5s',
            }}>
              {slide.title.split(' ').map((word, i, arr) =>
                i === arr.length - 1 ? (
                  <span key={i} style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> {word}</span>
                ) : (
                  <span key={i}> {word}</span>
                )
              )}
            </h1>

            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 520, marginBottom: 32 }}>
              {slide.sub}
            </p>

            {/* Slide dots */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  style={{
                    width: i === activeSlide ? 24 : 8, height: 8, borderRadius: 100, border: 'none', cursor: 'pointer',
                    background: i === activeSlide ? slide.accent : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.3s',
                    padding: 0,
                  }}
                />
              ))}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              {STATS.map(s => (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>{s.value}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Auth card */}
          <div id="auth-section" style={{
            background: 'rgba(20,23,29,0.9)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(139,92,246,0.4)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/finoria-ai.png" alt="Finoria" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: -0.3 }}>Finoria</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Kişisel Finansal Asistanınız</div>
              </div>
            </div>

            {/* Tab toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
              {['Giriş Yap', 'Kayıt Ol'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setIsRegisterMode(i === 1)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: (i === 0 ? !isRegisterMode : isRegisterMode)
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'transparent',
                    color: (i === 0 ? !isRegisterMode : isRegisterMode) ? '#fff' : 'rgba(255,255,255,0.35)',
                    fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                    boxShadow: (i === 0 ? !isRegisterMode : isRegisterMode) ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { placeholder: 'Kullanıcı adı', icon: '👤', type: 'text', value: username, onChange: setUsername },
                { placeholder: 'Şifre', icon: '🔒', type: 'password', value: password, onChange: setPassword },
              ].map(f => (
                <div key={f.placeholder} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: '0 14px', transition: 'border-color 0.2s',
                }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                >
                  <span style={{ fontSize: 14, flexShrink: 0, opacity: 0.5 }}>{f.icon}</span>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={e => f.onChange(e.target.value)}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: '#fff', fontSize: 14, padding: '14px 0', fontFamily: 'inherit',
                    }}
                  />
                </div>
              ))}

              {loginError && (
                <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, padding: '10px 14px' }}>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading || !username.trim() || !password.trim()}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: 0.3,
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                  transition: 'all 0.2s', marginTop: 4,
                  opacity: loginLoading || !username.trim() || !password.trim() ? 0.5 : 1,
                }}
              >
                {loginLoading ? 'Lütfen bekleyin...' : isRegisterMode ? '🚀 Hesap Oluştur' : '→ Giriş Yap'}
              </button>
            </form>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
              🔒 Tamamen ücretsiz · Verileriniz güvende · Başka biri ile paylaşılmaz
            </p>
          </div>
        </div>

        <style jsx>{`
          @keyframes heroPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.4); opacity: 0.7; }
          }
        `}</style>
      </section>

      {/* ===== SCREENSHOTS SHOWCASE ===== */}
      <section id="screenshots" style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: '#6366f1', textTransform: 'uppercase', marginBottom: 12 }}>Uygulama içi ekran görüntüleri</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: -1.5, color: '#fff' }}>
              Her şey, tek uygulamada
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginTop: 12, maxWidth: 500, margin: '12px auto 0' }}>
              Portföyünüzü profesyoneller gibi yönetin. Gerçek veriler, gerçek grafikler.
            </p>
          </div>

          <div id="features" style={{ display: 'flex', flexDirection: 'column', gap: 96 }}>
            {FEATURES.map((f, i) => (
              <div key={f.tag} style={{
                display: 'grid',
                gridTemplateColumns: i % 2 === 0 ? '1fr 1fr' : '1fr 1fr',
                gap: 64,
                alignItems: 'center',
                direction: i % 2 === 1 ? 'rtl' : 'ltr',
              }}>
                {/* Text side */}
                <div style={{ direction: 'ltr' }}>
                  <div style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: f.color, background: `${f.color}15`,
                    border: `1px solid ${f.color}30`, borderRadius: 6, padding: '4px 10px', marginBottom: 16,
                  }}>
                    {f.icon} {f.tag}
                  </div>
                  <h3 style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.8, color: '#fff', marginBottom: 14, lineHeight: 1.2 }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 24 }}>
                    {f.desc}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {f.bullets.map(b => (
                      <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${f.color}20`, border: `1px solid ${f.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color }} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Screenshot side */}
                <div style={{ direction: 'ltr' }}>
                  <div style={{
                    borderRadius: 20, overflow: 'hidden',
                    border: `1px solid ${f.color}20`,
                    boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 40px ${f.color}10`,
                    transform: 'perspective(1200px) rotateY(0deg)',
                    transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
                    background: '#0d1117',
                  }}
                    onMouseOver={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.boxShadow = `0 32px 80px rgba(0,0,0,0.6), 0 0 60px ${f.color}20`;
                      el.style.transform = 'perspective(1200px) rotateY(-2deg) rotateX(1deg) translateY(-4px)';
                    }}
                    onMouseOut={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.boxShadow = `0 24px 64px rgba(0,0,0,0.5), 0 0 40px ${f.color}10`;
                      el.style.transform = 'perspective(1200px) rotateY(0deg)';
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.imgSrc}
                      alt={f.imgAlt}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                      onError={e => {
                        // Fallback: show a styled placeholder if screenshot not found
                        const target = e.currentTarget as HTMLImageElement;
                        const parent = target.parentElement!;
                        parent.style.minHeight = '280px';
                        parent.style.display = 'flex';
                        parent.style.alignItems = 'center';
                        parent.style.justifyContent = 'center';
                        target.style.display = 'none';
                        const div = document.createElement('div');
                        div.innerHTML = `<div style="text-align:center;padding:48px;opacity:0.3"><div style="font-size:48px">${f.icon}</div><div style="margin-top:12px;font-size:14px;color:#fff">${f.imgAlt}</div></div>`;
                        parent.appendChild(div);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI CHAT SHOWCASE ===== */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(99,102,241,0.03)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: '#8b5cf6', textTransform: 'uppercase', marginBottom: 12 }}>Finoria AI</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: -1.5, color: '#fff', marginBottom: 16 }}>
            Kişisel finans asistanınız
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
            Sabah portföyünüzü Finoria AI analiz eder. En çok düşen varlığınızı, piyasa durumunu ve önerileri sohbet şeklinde sunar.
          </p>

          {/* AI Chat preview card */}
          <div style={{
            maxWidth: 360, margin: '0 auto',
            background: 'linear-gradient(160deg, rgba(30,22,53,0.95), rgba(14,17,25,0.95))',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.15)',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(139,92,246,0.4)', flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/finoria-ai.png" alt="Finoria AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Finoria AI</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Kişisel Finans Asistanın</div>
                </div>
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 8px', textAlign: 'left' }}>Selam Batuhan! 👋</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', margin: '0 0 6px', textAlign: 'left' }}>Portföyün bugün %0.57 küçüldü</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5, textAlign: 'left' }}>
                En çok düşen yatırımın 22 Ayar Bilezik. Tıkla ve birlikte inceleyelim.
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 16, padding: '10px 14px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Birlikte inceleyelim mi?</span>
                <span style={{ fontSize: 16, color: '#ef4444' }}>→</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAND ===== */}
      <section style={{ padding: '64px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {STATS.map(s => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '28px 16px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, transition: 'all 0.2s',
            }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.2)'; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: '#fff', marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA BOTTOM ===== */}
      <section style={{ padding: '80px 24px 96px', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: '#10b981', textTransform: 'uppercase', marginBottom: 16 }}>Ücretsiz başlayın</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: -1.5, color: '#fff', marginBottom: 16, lineHeight: 1.1 }}>
            Servetinizi <span style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>bugün</span> takibe alın
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 32 }}>
            Hesap oluşturmak ücretsiz ve sadece bir dakikanızı alır. Kredi kartı gerekmez.
          </p>
          <button
            onClick={() => { setIsRegisterMode(true); document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' }); }}
            style={{
              padding: '16px 40px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: 0.3,
              boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.65)'; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.5)'; }}
          >
            🚀 Ücretsiz Hesap Oluştur
          </button>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 16 }}>
            Tamamen ücretsiz · Reklam yok · Veri satılmaz
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: '24px', textAlign: 'center',
        fontSize: 12, color: 'rgba(255,255,255,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/finoria-ai.png" alt="Finoria" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span>© 2026 Finoria · Kişisel Servet Yönetimi</span>
        </div>
      </footer>
    </div>
  );
}
