import {NextRequest, NextResponse} from "next/server"
import {createClient} from "@/lib/supabase/server"
import {logger} from "@/lib/logger"
import type {UserRole} from "@/types/database"
import type {ApiResponse} from "@/types/api"

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  companyId: string | null
  name: string
}

/**
 * Extrai o token Bearer do header Authorization
 */
export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization")
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  
  return authHeader.slice(7) // Remove "Bearer "
}

/**
 * Autentica um usuário via JWT Bearer token ou cookies (para compatibilidade)
 * Retorna o usuário autenticado ou null se não autenticado
 */
export async function authenticateUser(request: NextRequest): Promise<AuthUser | null> {
  const bearerToken = getBearerToken(request)
  
  // Se tiver Bearer token, validar via Supabase
  if (bearerToken) {
    try {
      // Para validar Bearer token, precisamos criar um cliente com o token
      const {createClient: createSupabaseClient} = await import("@supabase/supabase-js")
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${bearerToken}`
            }
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      )
      
      // Validar o token JWT passando o token diretamente
      const {data: {user: authUser}, error: authError} = await supabase.auth.getUser(bearerToken)
      
      if (authError || !authUser) {
        logger.debug({
          message: "API auth: Bearer token inválido",
          error: authError?.message,
          path: request.nextUrl.pathname
        })
        return null
      }
      
      // Buscar dados do usuário na tabela users
      const {data: userData, error: userError} = await supabase
        .from("users")
        .select("id, role, company_id, name, email")
        .eq("auth_user_id", authUser.id)
        .single()
      
      if (userError || !userData) {
        logger.debug({
          message: "API auth: Usuário não encontrado na tabela users",
          authUserId: authUser.id,
          error: userError?.message,
          path: request.nextUrl.pathname
        })
        return null
      }
      
      logger.debug({
        message: "API auth: Usuário autenticado via Bearer token",
        userId: userData.id,
        role: userData.role,
        path: request.nextUrl.pathname
      })
      
      return {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        companyId: userData.company_id,
        name: userData.name
      }
    } catch (error) {
      logger.error({
        message: "API auth: Erro ao validar Bearer token",
        error: error instanceof Error ? error.message : String(error),
        path: request.nextUrl.pathname
      })
      return null
    }
  }
  
  // Fallback: autenticação via cookies (quando o client não envia Bearer)
  try {
    const supabase = await createClient()
    const {data: {user: authUser}, error: authError} = await supabase.auth.getUser()

    if (authError || !authUser) {
      return null
    }

    const {data: userData, error: userError} = await supabase
      .from("users")
      .select("id, role, company_id, name, email")
      .eq("auth_user_id", authUser.id)
      .single()
    
    if (userError || !userData) {
      return null
    }
    
    return {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      companyId: userData.company_id,
      name: userData.name
    }
  } catch (error) {
    logger.error({
      message: "API auth: Erro ao validar via cookies",
      error: error instanceof Error ? error.message : String(error),
      path: request.nextUrl.pathname
    })
    return null
  }
}

/**
 * Requer autenticação. Retorna JSON 401 se não autenticado.
 * NUNCA usa redirect() - sempre retorna JSON para APIs.
 */
export async function requireAuthApi(request: NextRequest): Promise<AuthUser> {
  const user = await authenticateUser(request)
  
  if (!user) {
    logger.warn({
      message: "API auth: Requisição não autenticada",
      path: request.nextUrl.pathname,
      method: request.method
    })
    throw new ApiAuthError("UNAUTHORIZED", "Authentication required")
  }
  
  return user
}

/**
 * Requer um role específico. Retorna JSON 403 se não tiver permissão.
 */
export async function requireRoleApi(request: NextRequest, role: UserRole): Promise<AuthUser> {
  const user = await requireAuthApi(request)
  
  if (user.role !== role) {
    logger.warn({
      message: "API auth: Acesso negado - role insuficiente",
      path: request.nextUrl.pathname,
      method: request.method,
      userId: user.id,
      userRole: user.role,
      requiredRole: role
    })
    throw new ApiAuthError("FORBIDDEN", `Access denied. Required role: ${role}`)
  }
  
  return user
}

/**
 * Requer role de admin ou super_admin. Retorna JSON 403 se não tiver permissão.
 * super_admin tem acesso a tudo que admin tem acesso.
 */
export async function requireAdminApi(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuthApi(request)
  
  // super_admin tem acesso a tudo que admin tem
  if (user.role !== "admin" && user.role !== "super_admin") {
    logger.warn({
      message: "API auth: Acesso negado - requer role admin ou super_admin",
      path: request.nextUrl.pathname,
      method: request.method,
      userId: user.id,
      userRole: user.role
    })
    throw new ApiAuthError("FORBIDDEN", "Access denied. Required role: admin or super_admin")
  }
  
  return user
}

/**
 * Requer role de super_admin. Retorna JSON 403 se não for super_admin.
 */
export async function requireSuperAdminApi(request: NextRequest): Promise<AuthUser> {
  return requireRoleApi(request, "super_admin")
}

/**
 * Erro customizado para autenticação de API
 * Sempre retorna JSON, nunca redirect
 */
export class ApiAuthError extends Error {
  constructor(
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN",
    message: string
  ) {
    super(message)
    this.name = "ApiAuthError"
  }
  
  toResponse(): NextResponse<ApiResponse> {
    const statusCode = this.code === "UNAUTHORIZED" ? 401 : 403
    
    return NextResponse.json(
      {
        success: false,
        error: this.code
      } as ApiResponse,
      {status: statusCode}
    )
  }
}

/**
 * Wrapper para handlers de API que captura ApiAuthError e retorna JSON apropriado
 */
export function withApiAuth<T>(
  handler: (request: NextRequest, user: AuthUser, ...args: any[]) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse<T | ApiResponse>> => {
    try {
      // Determinar qual role é necessário baseado no path
      const pathname = request.nextUrl.pathname
      
      let user: AuthUser
      
      if (pathname.includes("/super-admin/")) {
        user = await requireSuperAdminApi(request)
      } else if (pathname.includes("/admin/") || pathname.includes("/api-keys")) {
        user = await requireAdminApi(request)
      } else {
        user = await requireAuthApi(request)
      }
      
      return await handler(request, user, ...args)
    } catch (error) {
      if (error instanceof ApiAuthError) {
        return error.toResponse()
      }
      
      // Re-throw outros erros para serem tratados pelo handler
      throw error
    }
  }
}
