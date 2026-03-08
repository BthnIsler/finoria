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
    icon: '📊',
    title: 'Tüm Varlıklarınız Tek Yerde',
    desc: 'Hisse senetleri, kripto, altın, döviz ve daha fazlasını tek panelden yönetin.',
  },
  {
    icon: '⚡',
    title: 'Canlı Fiyat Takibi',
    desc: 'Piyasa fiyatları her 30 saniyede otomatik güncellenir. Her zaman anlık bilgi.',
  },
  {
    icon: '🤖',
    title: 'AI Portföy Asistanı',
    desc: 'Yapay zeka destekli analiz ile portföyünüzü derinlemesine inceleyin.',
  },
  {
    icon: '🎯',
    title: 'Finansal Hedefler',
    desc: 'Hayalinizdeki hedeflere giden yolu görselleştirin ve takip edin.',
  },
  {
    icon: '🔒',
    title: 'Güvenli & Özel',
    desc: 'Verileriniz yalnızca sizinle. Başkasıyla paylaşılmaz.',
  },
  {
    icon: '🌍',
    title: 'Çok Para Birimi',
    desc: 'TRY, USD ve EUR arasında anında dönüştürme. Küresel portföy yönetimi.',
  },
];

const STATS = [
  { value: '₺1,2M', label: 'Ortalama portföy büyüklüğü' },
  { value: '%18', label: 'Ortalama yıllık getiri' },
  { value: '12+', label: 'Desteklenen varlık sınıfı' },
  { value: '7/24', label: 'Anlık takip' },
];

const SLIDES = [
  {
    title: 'Servetinizi gerçek zamanlı görün',
    sub: 'Toplam varlığınız, kar/zarar durumunuz ve portföy dağılımı. Hepsi tek ekranda.',
    badge: '🔥 Canlı güncelleme',
  },
  {
    title: 'Akıllı portföy analizi',
    sub: 'AI destekli içgörüler ile hangi varlığın nasıl performans gösterdiğini anlayın.',
    badge: '🤖 AI destekli',
  },
  {
    title: 'Önemli tarihleri kaçırmayın',
    sub: 'Merkez bandı faiz kararları, şirket bilanço günleri ve daha fazlası için geri sayım.',
    badge: '📅 Takvim takibi',
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

  useEffect(() => {
    const t = setInterval(() => setActiveSlide((s) => (s + 1) % SLIDES.length), 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="landing-root">
      {/* ====== NAV ====== */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span className="landing-logo-icon">💎</span>
            <span className="landing-logo-text">Finoria</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Özellikler</a>
            <a href="#stats">İstatistikler</a>
          </div>
          <button
            className="landing-nav-cta"
            onClick={() => {
              document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Hemen Başla →
          </button>
        </div>
      </nav>

      {/* ====== HERO ====== */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="landing-blob landing-blob-1" />
          <div className="landing-blob landing-blob-2" />
        </div>
        <div className="landing-hero-inner">
          <div className="landing-hero-left">
            {/* Slide badge */}
            <div className="landing-slide-badge">
              {SLIDES[activeSlide].badge}
            </div>

            <h1 className="landing-h1">
              {SLIDES[activeSlide].title
                .split(' ')
                .map((word, i, arr) =>
                  i === arr.length - 1 ? (
                    <span key={i} className="landing-h1-accent"> {word}</span>
                  ) : (
                    <span key={i}> {word}</span>
                  )
                )}
            </h1>

            <p className="landing-sub">{SLIDES[activeSlide].sub}</p>

            {/* Slide indicators */}
            <div className="landing-dots">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  className={`landing-dot${i === activeSlide ? ' landing-dot--active' : ''}`}
                  onClick={() => setActiveSlide(i)}
                />
              ))}
            </div>

            {/* Quick stats */}
            <div className="landing-stats">
              {STATS.map((s) => (
                <div key={s.label} className="landing-stat">
                  <div className="landing-stat-value">{s.value}</div>
                  <div className="landing-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ====== AUTH FORM ====== */}
          <div className="landing-hero-right" id="auth-section">
            <div className="landing-card">
              <div className="landing-card-header">
                <span className="landing-card-emoji">💎</span>
                <span className="landing-card-brand">Finoria</span>
                <p className="landing-card-tagline">Kişisel yatırım asistanınız</p>
              </div>

              {/* Tab toggle */}
              <div className="landing-tabs">
                <button
                  className={`landing-tab${!isRegisterMode ? ' landing-tab--active' : ''}`}
                  onClick={() => setIsRegisterMode(false)}
                >
                  Giriş Yap
                </button>
                <button
                  className={`landing-tab${isRegisterMode ? ' landing-tab--active' : ''}`}
                  onClick={() => setIsRegisterMode(true)}
                >
                  Kayıt Ol
                </button>
              </div>

              <form onSubmit={onSubmit} className="landing-form">
                <div className="landing-input-wrapper">
                  <span className="landing-input-icon">👤</span>
                  <input
                    type="text"
                    placeholder="Kullanıcı adı"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="landing-input"
                    autoFocus
                  />
                </div>
                <div className="landing-input-wrapper">
                  <span className="landing-input-icon">🔒</span>
                  <input
                    type="password"
                    placeholder="Şifre"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="landing-input"
                  />
                </div>

                {loginError && (
                  <div className="landing-error">{loginError}</div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading || !username.trim() || !password.trim()}
                  className="landing-submit"
                >
                  {loginLoading
                    ? 'Lütfen bekleyin...'
                    : isRegisterMode
                    ? 'Hesap Oluştur'
                    : 'Giriş Yap'}
                </button>
              </form>

              <p className="landing-fine-print">
                Giriş yaparak gizlilik politikamızı kabul etmiş sayılırsınız.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FEATURES ====== */}
      <section className="landing-features" id="features">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Her şey burada</h2>
          <p className="landing-section-sub">
            Premium bir finans deneyimi için ihtiyacınız olan her şey tek uygulamada.
          </p>
          <div className="landing-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">{f.icon}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== STATS BAND ====== */}
      <section className="landing-stats-band" id="stats">
        <div className="landing-section-inner">
          <div className="landing-stats-grid">
            {STATS.map((s) => (
              <div key={s.label} className="landing-stats-card">
                <div className="landing-stats-value">{s.value}</div>
                <div className="landing-stats-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== CTA BOTTOM ====== */}
      <section className="landing-cta-section">
        <div className="landing-section-inner landing-cta-inner">
          <h2 className="landing-cta-title">
            Servetinizi <span className="landing-h1-accent">bugün</span> takibe alın
          </h2>
          <p className="landing-cta-sub">
            Ücretsiz hesap oluşturun, dakikalar içinde başlayın.
          </p>
          <button
            className="landing-cta-btn"
            onClick={() => {
              setIsRegisterMode(true);
              document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Ücretsiz Başla →
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© 2025 Finoria. Kişisel Servet Yönetimi.</span>
      </footer>
    </div>
  );
}
