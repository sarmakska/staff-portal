"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/providers"
import { LayoutDashboard, Clock, CalendarDays, UserPlus, Settings, Monitor, ClipboardList, Shield, ShieldAlert } from "lucide-react"

const mobileItems = [
  { href: "/", label: "Home", icon: LayoutDashboard, roles: ["employee", "manager", "admin", "hr", "reception"] },
  { href: "/attendance", label: "Attend", icon: Clock, roles: ["employee", "manager", "admin", "hr", "reception"] },
  { href: "/leave", label: "Leave", icon: CalendarDays, roles: ["employee", "manager", "admin", "hr"] },
  { href: "/visitors", label: "Visitors", icon: UserPlus, roles: ["employee", "manager", "admin", "reception"] },
  { href: "/reception", label: "Desk", icon: Monitor, roles: ["reception"] },
  { href: "/admin/roll-call", label: "Roll Call", icon: ShieldAlert, roles: ["admin", "reception"] },
  { href: "/manager/approvals", label: "Approve", icon: ClipboardList, roles: ["manager", "hr"] },
  { href: "/admin/users", label: "Admin", icon: Shield, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["employee", "manager", "admin", "hr", "reception"] },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { roles } = useAuth()

  // Show nav items where the user has at least one matching role
  const items = mobileItems.filter((item) => roles.some(r => item.roles.includes(r))).slice(0, 5)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-md py-1.5 md:hidden safe-area-inset-bottom">
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors",
              isActive ? "text-brand-taupe" : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive && "text-brand-taupe")} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
