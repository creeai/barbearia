import {redirect} from "next/navigation"
import {requireSuperAdmin, getCurrentUser} from "@/lib/auth/helpers"
import {DashboardLayout} from "@/components/layout/DashboardLayout"
import {UsersPageClient} from "@/components/super-admin/UsersPageClient"

export default async function UsersPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== "super_admin") {
    redirect("/login")
  }

  return (
    <DashboardLayout userRole={user.role} userName={user.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Users</h2>
        </div>

        <UsersPageClient currentUserId={user?.id} />
      </div>
    </DashboardLayout>
  )
}
