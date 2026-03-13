import {createClient} from "@/lib/supabase/server"
import {redirect} from "next/navigation"
import type {UserRole} from "@/types/database"
import {logger} from "@/lib/logger"

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  companyId: string | null
  name: string
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  logger.debug({
    message: "getCurrentUser: Iniciando verificação de usuário"
  })

  const supabase = await createClient()
  const {
    data: {user: authUser},
    error: authError
  } = await supabase.auth.getUser()

  logger.debug({
    message: "getCurrentUser: Resultado do getUser",
    hasAuthUser: !!authUser,
    authUserId: authUser?.id,
    authError: authError?.message
  })

  if (!authUser) {
    logger.debug({
      message: "getCurrentUser: Usuário não autenticado"
    })
    return null
  }

  const {data: userData, error: userError} = await supabase
    .from("users")
    .select("id, role, company_id, name, email")
    .eq("auth_user_id", authUser.id)
    .single()

  logger.debug({
    message: "getCurrentUser: Resultado da consulta de usuário",
    hasUserData: !!userData,
    userData: userData ? {id: userData.id, email: userData.email, role: userData.role} : null,
    userError: userError?.message,
    userErrorCode: userError?.code,
    authUserId: authUser.id
  })

  if (!userData) {
    logger.warn({
      message: "getCurrentUser: Usuário não encontrado na tabela users",
      authUserId: authUser.id,
      userError: userError
    })
    return null
  }

  logger.info({
    message: "getCurrentUser: Usuário encontrado",
    userId: userData.id,
    email: userData.email,
    role: userData.role
  })

  return {
    id: userData.id,
    email: userData.email,
    role: userData.role,
    companyId: userData.company_id,
    name: userData.name
  }
}

/** Retorna o access_token da sessão Supabase para o client enviar nas chamadas à API. */
export async function getSessionToken(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: {session},
    error
  } = await supabase.auth.getSession()
  if (error || !session?.access_token) return null
  return session.access_token
}

export async function requireAuth(): Promise<AuthUser> {
  logger.debug({
    message: "requireAuth: Verificando autenticação"
  })

  const user = await getCurrentUser()

  if (!user) {
    logger.warn({
      message: "requireAuth: Usuário não autenticado, redirecionando para /login"
    })
    redirect("/login")
  }

  logger.debug({
    message: "requireAuth: Usuário autenticado",
    userId: user.id,
    role: user.role
  })

  return user
}

export async function requireRole(role: UserRole): Promise<AuthUser> {
  const user = await requireAuth()

  if (user.role !== role) {
    redirect("/")
  }

  return user
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  return requireRole("super_admin")
}

export async function requireAdmin(): Promise<AuthUser> {
  return requireRole("admin")
}
