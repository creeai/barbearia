import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/auth/helpers"
import {DashboardLayout} from "@/components/layout/DashboardLayout"
import {ProfessionalsPageClient} from "@/components/admin/ProfessionalsPageClient"

export default async function ProfissionaisPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    redirect("/login")
  }

  return (
    <DashboardLayout userRole={user.role} userName={user.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Profissionais</h2>
        </div>
        <p className="text-muted-foreground">
          Cadastre os barbeiros e profissionais que atendem na sua barbearia.
        </p>
        <ProfessionalsPageClient />
      </div>
    </DashboardLayout>
  )
}
