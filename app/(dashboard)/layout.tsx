import {redirect} from "next/navigation"
import {getCurrentUser, getSessionToken} from "@/lib/auth/helpers"
import {ApiAuthProvider} from "@/components/providers/ApiAuthProvider"
import {logger} from "@/lib/logger"

export default async function DashboardLayout({children}: {children: React.ReactNode}) {
  logger.debug({
    message: "DashboardLayout: Verificando autenticação"
  })

  const user = await getCurrentUser()

  if (!user) {
    logger.warn({
      message: "DashboardLayout: Usuário não autenticado, redirecionando para /login"
    })
    redirect("/login")
  }

  const accessToken = await getSessionToken()

  logger.debug({
    message: "DashboardLayout: Usuário autenticado",
    userId: user.id,
    role: user.role
  })

  return <ApiAuthProvider accessToken={accessToken}>{children}</ApiAuthProvider>
}
