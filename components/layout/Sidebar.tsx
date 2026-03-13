"use client"

import Link from "next/link"
import {usePathname} from "next/navigation"
import {cn} from "@/lib/utils"
import {Building2, Users, Key, Scissors, UserCircle, CalendarX2, CalendarCheck} from "lucide-react"

interface SidebarProps {
  userRole: "super_admin" | "admin"
}

export function Sidebar({userRole}: SidebarProps) {
  const pathname = usePathname()

  const superAdminNav = [
    {
      title: "Companies",
      href: "/super-admin/companies",
      icon: Building2
    },
    {
      title: "Users",
      href: "/super-admin/users",
      icon: Users
    },
    {
      title: "API Keys",
      href: "/super-admin/api-keys",
      icon: Key
    }
  ]

  const adminNav = [
    {
      title: "Serviços",
      href: "/admin/servicos",
      icon: Scissors
    },
    {
      title: "Profissionais",
      href: "/admin/profissionais",
      icon: UserCircle
    },
    {
      title: "Horários bloqueados",
      href: "/admin/horarios-bloqueados",
      icon: CalendarX2
    },
    {
      title: "Agendamentos",
      href: "/admin/agendamentos",
      icon: CalendarCheck
    }
  ]

  const navItems = userRole === "super_admin" ? superAdminNav : adminNav

  return (
    <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-card md:min-h-[calc(100vh-73px)]">
      <nav className="px-3 py-3 md:p-4 space-y-1 md:space-y-2 flex md:block overflow-x-auto md:overflow-visible">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 md:gap-3 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
