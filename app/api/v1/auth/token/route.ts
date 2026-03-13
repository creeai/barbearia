import {NextRequest, NextResponse} from "next/server"
import {createClient} from "@/lib/supabase/server"
import {addCorsHeaders} from "@/lib/cors"

/**
 * GET /api/v1/auth/token
 * 
 * Retorna o JWT (access token) do usuário autenticado.
 * Requer autenticação via cookies (login no painel).
 * 
 * Resposta de sucesso (200):
 * {
 *   "success": true,
 *   "data": {
 *     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "refreshToken": "...",
 *     "expiresAt": 1234567890,
 *     "expiresIn": 3600,
 *     "user": {
 *       "id": "uuid",
 *       "email": "user@example.com"
 *     }
 *   }
 * }
 * 
 * Resposta de erro (401):
 * {
 *   "success": false,
 *   "error": "Não autenticado"
 * }
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")

  try {
    const supabase = await createClient()
    const {data: {session}, error: sessionError} = await supabase.auth.getSession()

    if (sessionError || !session) {
      const response = NextResponse.json(
        {
          success: false,
          error: "Não autenticado. Faça login primeiro."
        },
        {status: 401}
      )
      return addCorsHeaders(response, origin)
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
          expiresIn: session.expires_in,
          user: {
            id: session.user.id,
            email: session.user.email,
            phone: session.user.phone
          }
        }
      },
      {status: 200}
    )

    return addCorsHeaders(response, origin)
  } catch (error) {
    const response = NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao obter token"
      },
      {status: 500}
    )
    return addCorsHeaders(response, origin)
  }
}
