"use client"

import { AppSidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { MobileBottomNav } from "@/components/layout/mobile-nav"
import { Footer } from "@/components/shared/footer"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      <div className="print:hidden"><AppSidebar /></div>
      <div className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <div className="print:hidden"><Topbar /></div>
        <div className="flex-1 overflow-y-auto bg-background scroll-smooth print:overflow-visible">
          <main className="min-h-[calc(100dvh-theme(spacing.16)-theme(spacing.12))] pb-20 md:pb-0 print:min-h-0 print:pb-0">
            {children}
          </main>
          <div className="print:hidden"><Footer /></div>
        </div>
        <div className="print:hidden"><MobileBottomNav /></div>
      </div>
    </div>
  )
}
