import type { Metadata } from 'next'
import type { Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { PwaRegistrar } from '@/components/pwa-registrar'
import '@excalidraw/excalidraw/index.css'
import './globals.css'

// Removed Google Fonts to fix build issues and improve local-first reliability
const _geist = { variable: '--font-geist-sans', className: 'font-sans' };
const _geistMono = { variable: '--font-geist-mono', className: 'font-mono' };

export const metadata: Metadata = {
  title: 'Eridian',
  description: 'A local sketch workspace for focused drawing.',
  generator: 'v0.app',
  applicationName: 'Eridian',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Eridian',
    startupImage: [
      '/apple-icon.png',
    ],
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1e8' },
    { media: '(prefers-color-scheme: dark)', color: '#101010' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <PwaRegistrar />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
