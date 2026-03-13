import {NextRequest, NextResponse} from "next/server"
import {requireSuperAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {apiKeyService} from "@/lib/services/api-key.service"
import {createServiceClient} from "@/lib/supabase/server"
import {logger} from "@/lib/logger"
import type {ApiResponse} from "@/types/api"

export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const startTime = Date.now()

  try {
    logger.request({
      method: "PATCH",
      path: `/api/v1/api-keys/${params.id}/revoke`
    })

    const user = await requireSuperAdminApi(request)

    const supabase = await createServiceClient()
    const {data: apiKey, error: keyError} = await supabase
      .from("api_keys")
      .select(
        `
        id,
        api_clients!inner (
          company_id
        )
      `
      )
      .eq("id", params.id)
      .single()

    if (keyError || !apiKey) {
      const response: ApiResponse = {
        success: false,
        error: "API key not found"
      }
      return NextResponse.json(response, {status: 404})
    }

    const apiClient = Array.isArray(apiKey.api_clients)
      ? apiKey.api_clients[0]
      : apiKey.api_clients

    await apiKeyService.revokeApiKey(params.id, apiClient.company_id, user.id)

    const response: ApiResponse = {
      success: true,
      data: {message: "API key revoked successfully"}
    }

    logger.response({
      method: "PATCH",
      path: `/api/v1/api-keys/${params.id}/revoke`,
      statusCode: 200,
      duration: Date.now() - startTime,
      response: response,
      userId: user.id
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error({
      message: "Error revoking API key",
      method: "PATCH",
      path: `/api/v1/api-keys/${params.id}/revoke`,
      error,
      duration: Date.now() - startTime
    })

    // Tratar erros de autenticação
    if (error instanceof ApiAuthError) {
      return error.toResponse()
    }

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }
    return NextResponse.json(response, {status: 500})
  }
}
