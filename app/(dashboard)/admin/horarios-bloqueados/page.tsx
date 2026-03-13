import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/auth/helpers"
import {DashboardLayout} from "@/components/layout/DashboardLayout"
import {BlockedSlotsPageClient} from "@/components/admin/BlockedSlotsPageClient"

export default async function HorariosBloqueadosPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    redirect("/login")
  }

  return (
    <DashboardLayout userRole={user.role} userName={user.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Horários bloqueados</h2>
        </div>
        <p className="text-muted-foreground">
          Bloqueie horários específicos (ex.: almoço, folga) para que não apareçam como disponíveis para agendamento.
        </p>
        <BlockedSlotsPageClient />
      </div>
    </DashboardLayout>
  )
}
