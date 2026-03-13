import {redirect} from "next/navigation"
import {createClient} from "@/lib/supabase/server"
import {logger} from "@/lib/logger"

export default async function HomePage() {
  logger.info({
    message: "HomePage: Iniciando verificação de autenticação",
    path: "/"
  })

  const supabase = await createClient()
  const {
    data: {user},
    error: authError
  } = await supabase.auth.getUser()

  logger.debug({
    message: "HomePage: Resultado do getUser",
    hasUser: !!user,
    userId: user?.id,
    authError: authError?.message
  })

  if (!user) {
    logger.warn({
      message: "HomePage: Usuário não autenticado, redirecionando para /login"
    })
    redirect("/login")
  }

  // Verificar role e redirecionar
  const {data: userData, error: userError} = await supabase
    .from("users")
    .select("role, id, email, name")
    .eq("auth_user_id", user.id)
    .single()

  logger.debug({
    message: "HomePage: Resultado da consulta de usuário",
    hasUserData: !!userData,
    userData: userData ? {id: userData.id, email: userData.email, role: userData.role} : null,
    userError: userError?.message,
    userErrorCode: userError?.code
  })

  if (!userData) {
    logger.error({
      message: "HomePage: Usuário não encontrado na tabela users",
      authUserId: user.id,
      userError: userError
    })
    redirect("/login")
  }

  logger.info({
    message: "HomePage: Usuário encontrado, verificando role",
    userId: userData.id,
    role: userData.role
  })

  if (userData.role === "super_admin") {
    logger.info({
      message: "HomePage: Redirecionando super_admin para /super-admin/companies",
      userId: userData.id
    })
    redirect("/super-admin/companies")
  } else if (userData.role === "admin") {
    logger.info({
      message: "HomePage: Redirecionando admin para painel da barbearia",
      userId: userData.id
    })
    redirect("/admin/servicos")
  }

  logger.warn({
    message: "HomePage: Role não reconhecido, redirecionando para /login",
    role: userData.role,
    userId: userData.id
  })
  redirect("/login")
}
