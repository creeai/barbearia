import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/auth/helpers"
import {DashboardLayout} from "@/components/layout/DashboardLayout"
import {BookingsPageClient} from "@/components/admin/BookingsPageClient"

export default async function AgendamentosPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    redirect("/login")
  }

  return (
    <DashboardLayout userRole={user.role} userName={user.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Agendamentos</h2>
        </div>
        <p className="text-muted-foreground">
          Veja todos os agendamentos e crie ou edite agendamentos para os clientes.
        </p>
        <BookingsPageClient />
      </div>
    </DashboardLayout>
  )
}
