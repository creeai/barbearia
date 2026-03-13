import {createServerClient} from "@supabase/ssr"
import {cookies} from "next/headers"
import type {NextRequest} from "next/server"

/**
 * Cria cliente Supabase usando os cookies do next/headers (Server Components, etc.)
 */
export async function createClient() {
  const cookieStore = await cookies()
  type CookieToSet = {
    name: string
    value: string
    options?: Parameters<typeof cookieStore.set>[2]
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({name, value, options}) => cookieStore.set(name, value, options))
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      }
    }
  })
}

/**
 * Parse do header Cookie para array { name, value }.
 * Suporta getAll() com ou sem keyHints (assinatura do @supabase/ssr).
 */
function parseCookieHeader(cookieHeader: string): {name: string; value: string}[] {
  if (!cookieHeader.trim()) return []
  return cookieHeader
    .split(";")
    .map((part) => {
      const eq = part.indexOf("=")
      const name = (eq === -1 ? part : part.slice(0, eq)).trim()
      const value = (eq === -1 ? "" : part.slice(eq + 1)).trim()
      return {name, value}
    })
    .filter((c) => c.name.length > 0)
}

/**
 * Cria cliente Supabase usando explicitamente os cookies da requisição (Request).
 * Use em Route Handlers (API routes) para garantir que a sessão do browser seja lida.
 */
export function createClientFromRequest(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || ""

  const getAll = (_keyHints?: string[]): {name: string; value: string}[] => {
    return parseCookieHeader(cookieHeader)
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll,
      setAll(_cookiesToSet: {name: string; value: string}[]) {
        // Em Route Handlers não alteramos cookies na resposta por padrão
      }
    }
  })
}

export async function createServiceClient() {
  const {createClient: createSupabaseClient} = await import("@supabase/supabase-js")

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
