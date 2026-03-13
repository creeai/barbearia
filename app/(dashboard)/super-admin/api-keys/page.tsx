import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/auth/helpers"
import {DashboardLayout} from "@/components/layout/DashboardLayout"
import {ApiKeysPageClientSuperAdmin} from "@/components/super-admin/ApiKeysPageClientSuperAdmin"

export default async function ApiKeysPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== "super_admin") {
    redirect("/login")
  }

  return (
    <DashboardLayout userRole={user.role} userName={user.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">API Keys</h2>
        </div>
        <p className="text-muted-foreground">
          Crie e gerencie chaves de API para as empresas (barbearias) cadastradas. Apenas o super admin pode criar API
          Keys.
        </p>
        <ApiKeysPageClientSuperAdmin />
      </div>
    </DashboardLayout>
  )
}
