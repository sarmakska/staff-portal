"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/providers"
import {
  LayoutDashboard, Clock, FileSpreadsheet, FileEdit, CalendarDays, Users,
  UserPlus, BookOpen, MessageSquare, AlertTriangle, Settings, Shield,
  Monitor, Tablet, ClipboardList, ChevronLeft, ChevronRight, ShieldAlert, Contact,
  FileText, Bell, BarChart2, Server, LogOut, HelpCircle, TableProperties,
  Receipt, Megaphone,
} from "lucide-react"
import { useState } from "react"

type NavItem = { href: string; label: string; icon: React.ElementType; roles: string[] }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "admin", "director", "accounts", "reception"] },
    ],
  },
  {
    label: "MY WORK",
    items: [
      { href: "/attendance",  label: "Attendance",  icon: Clock,          roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/timesheets",      label: "Timesheets",    icon: FileSpreadsheet, roles: ["employee", "director", "accounts", "reception"] },
      { href: "/admin/timesheets", label: "My Timesheet", icon: FileSpreadsheet, roles: ["admin"] },
      { href: "/corrections", label: "Corrections", icon: FileEdit,        roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/leave",       label: "Leave",        icon: CalendarDays,   roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/diary",       label: "Diary",        icon: BookOpen,       roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/expenses",       label: "Expenses",      icon: Receipt,    roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/announcements",  label: "Announcements", icon: Megaphone,  roles: ["employee", "admin", "director", "accounts", "reception"] },
    ],
  },
  {
    label: "TEAM",
    items: [
      { href: "/calendar",         label: "Calendar",  icon: CalendarDays,  roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/directory",        label: "Directory", icon: Users,         roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/directory?tab=external", label: "Contacts", icon: Contact,  roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/manager/approvals", label: "Approvals", icon: ClipboardList, roles: ["employee", "admin", "director", "accounts", "reception"] },
    ],
  },
  {
    label: "OFFICE",
    items: [
      { href: "/visitors",               label: "Visitors",       icon: UserPlus,   roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/reception",              label: "Reception",      icon: Monitor,    roles: ["reception", "admin"] },
      { href: "/admin/roll-call",        label: "Roll Call",      icon: ShieldAlert, roles: ["admin", "director", "reception"] },
      { href: "/admin/kiosk-settings",   label: "Kiosk Settings", icon: Tablet,    roles: ["admin", "reception"] },
    ],
  },
  {
    label: "FEEDBACK",
    items: [
      { href: "/feedback",   label: "Feedback",   icon: MessageSquare, roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/complaints", label: "Complaints", icon: AlertTriangle,  roles: ["employee", "admin", "director", "accounts", "reception"] },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { href: "/admin/leave",               label: "Allowances",           icon: CalendarDays,    roles: ["director", "accounts"] },
      { href: "/admin/leave-records",       label: "Leave Records",        icon: FileText,        roles: ["director", "accounts"] },
      { href: "/admin/staff-summary",       label: "Staff Summary",        icon: TableProperties, roles: ["accounts", "director"] },
      { href: "/admin/attendance",          label: "Attendance",           icon: ClipboardList,   roles: ["reception"] },
      { href: "/admin/users",               label: "Roles & Users",        icon: Shield,          roles: [] },
      { href: "/admin/notifications",       label: "Notifications",        icon: Bell,            roles: ["admin"] },
      { href: "/analytics",                 label: "Analytics",            icon: BarChart2,       roles: ["director"] },
      { href: "/admin/forgotten-clockouts", label: "Forgotten Clock-outs", icon: LogOut,          roles: ["director", "reception"] },
      { href: "/admin/org",                 label: "Org Chart",            icon: Users,           roles: [] },
      { href: "/admin/system",              label: "System Status",        icon: Server,          roles: ["admin"] },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { href: "/settings",      label: "Settings",      icon: Settings,    roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/notifications", label: "Email Guide",   icon: Bell,        roles: ["employee", "admin", "director", "accounts", "reception"] },
      { href: "/help",          label: "How It Works",  icon: HelpCircle,  roles: ["employee", "admin", "director", "accounts", "reception"] },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { roles } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  const isAdmin = roles.includes("admin")

  // Auto-open admin group if currently on an admin page
  const isOnAdminPage = pathname.startsWith("/admin") || pathname.startsWith("/analytics")

  // Filter groups — only show groups that have at least one visible item
  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!roles.some(r => item.roles.includes(r))) return false
        if (isAdmin && item.href === "/timesheets") return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0 && group.label !== "ADMIN")

  // For admin: collapsible dropdown with all admin items
  // For other roles: normal visible group with only their permitted items
  const allAdminItems = navGroups.find(g => g.label === "ADMIN")?.items ?? []
  const adminItems = allAdminItems.filter(item =>
    isAdmin ? item.roles.includes("admin") : roles.some(r => item.roles.includes(r))
  )

  const showAdmin = adminItems.length > 0

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 shrink-0 h-screen sticky top-0",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="StaffPortal" className="h-7" />
            <span className="font-semibold text-sidebar-foreground text-sm">Nexus</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto">
            <img src="/logo.png" alt="StaffPortal" className="h-6" />
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.label}>
            {collapsed && groupIndex > 0 && (
              <div className="mb-3 h-px bg-sidebar-border/60 mx-1" />
            )}
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50 select-none">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105",
                      isActive ? "text-primary" : ""
                    )} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* ADMIN group — collapsible dropdown for admin, normal visible for others */}
        {showAdmin && (
          <div>
            {collapsed && <div className="mb-3 h-px bg-sidebar-border/60 mx-1" />}
            {!collapsed && (
              isAdmin ? (
                <button
                  onClick={() => setAdminOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 mb-1 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50 hover:text-muted-foreground transition-colors select-none"
                >
                  <span>Admin</span>
                  <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", (adminOpen || isOnAdminPage) ? "rotate-90" : "")} />
                </button>
              ) : (
                <p className="px-3 mb-1 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50 select-none">Admin</p>
              )
            )}
            {(isAdmin ? (adminOpen || isOnAdminPage || collapsed) : true) && (
              <div className="space-y-0.5">
                {adminItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-accent text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105",
                        isActive ? "text-primary" : ""
                      )} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-200"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>
    </aside>
  )
}
