"use client"

import {useRouter} from "next/navigation"
import {createClient} from "@/lib/supabase/client"
import {Button} from "@/components/ui/button"
import {LogOut} from "lucide-react"
import {Sidebar} from "./Sidebar"

interface DashboardLayoutProps {
  children: React.ReactNode
  userRole: "super_admin" | "admin"
  userName: string
}

export function DashboardLayout({children, userRole, userName}: DashboardLayoutProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <Sidebar userRole={userRole} />
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-card">
          <div className="px-4 md:px-6 py-3 md:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Painel Barbearia</h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                {userRole === "super_admin" ? "Super Admin" : "Admin"} - {userName}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full sm:w-auto justify-center"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
