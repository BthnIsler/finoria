import type { Metadata } from "next";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

export const metadata: Metadata = {
  title: "Servet Takip | Wealth Tracker",
  description: "Tüm yatırımlarınızı tek bir yerden anlık olarak takip edin. Altın, kripto, döviz, hisse senedi ve daha fazlası.",
  keywords: ["servet", "yatırım", "portföy", "altın", "bitcoin", "kripto", "döviz", "takip"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" data-theme="dark">
      <body>
        <ClientProviders>
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
