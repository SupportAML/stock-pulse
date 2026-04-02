import type { Metadata } from 'next';
import { GeistSans, GeistMono } from 'geist/font';
import './globals.css';
import ChatAdvisor from '@/components/markets/ChatAdvisor';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'StockPulse - AI-Powered Trading',
  description: 'AI-powered paper trading platform with real-time data, predictions, and technical analysis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="bg-gray-950 text-white min-h-screen antialiased">
        <Providers>
          {children}
          <ChatAdvisor />
        </Providers>
      </body>
    </html>
  );
}
