import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Memo Kiosk',
  manifest: '/manifest-kiosk.json',
  icons: {
    icon: '/favicon-dino.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Memo Kiosk',
  },
}

export const viewport: Viewport = {
  userScalable: false,
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return children
}
