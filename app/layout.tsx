import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Lumina - AI-Powered Hyperliquid Intelligence',
  description: 'Illuminating Hyperliquid blockchain data with AI. Advanced trading-focused explorer providing intelligent insights, risk assessment, and transaction analysis.',
  keywords: 'Lumina, blockchain, explorer, AI, Hyperliquid, HyperEVM, transactions, trading, analysis, intelligence, insights',
  authors: [{ name: 'Lumina Team' }],
  openGraph: {
    title: 'Lumina - AI-Powered Hyperliquid Intelligence',
    description: 'Illuminating Hyperliquid blockchain data with AI. Advanced trading-focused explorer providing intelligent insights.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lumina - AI-Powered Hyperliquid Intelligence',
    description: 'Illuminating Hyperliquid blockchain data with AI. Advanced trading-focused explorer providing intelligent insights.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3B82F6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="canonical" href="https://lumina.ai" />
      </head>
      <body className={inter.className} suppressHydrationWarning>{children}</body>
    </html>
  );
}