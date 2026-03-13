import {NextRequest, NextResponse} from "next/server"
import {requireSuperAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {apiKeyService} from "@/lib/services/api-key.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const createApiKeySchema = z.object({
  label: z.string().min(1),
  companyId: z.string().uuid() // Obrigatório: super admin escolhe a empresa
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    logger.request({
      method: "POST",
      path: "/api/v1/api-keys"
    })

    const user = await requireSuperAdminApi(request)

    const body = await request.json()
    logger.debug({
      message: "Request payload",
      method: "POST",
      path: "/api/v1/api-keys",
      payload: body,
      userId: user.id
    })

    const validated = createApiKeySchema.parse(body)

    const result = await apiKeyService.createApiKey({
      companyId: validated.companyId,
      label: validated.label,
      userId: user.id
    })

    const response: ApiResponse = {
      success: true,
      data: {
        id: result.id,
        key: result.fullKey, // Mostrar apenas uma vez
        label: result.label,
        createdAt: result.createdAt
      }
    }

    const logResponse = response.data 
      ? {...response, data: {...response.data, key: "[REDACTED]"}}
      : response

    logger.response({
      method: "POST",
      path: "/api/v1/api-keys",
      statusCode: 201,
      duration: Date.now() - startTime,
      response: logResponse,
      userId: user.id,
      companyId: validated.companyId
    })

    return NextResponse.json(response, {status: 201})
  } catch (error) {
    logger.error({
      message: "Error creating API key",
      method: "POST",
      path: "/api/v1/api-keys",
      error,
      duration: Date.now() - startTime
    })

    // Tratar erros de autenticação
    if (error instanceof ApiAuthError) {
      return error.toResponse()
    }

    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: "Validation error",
        errors: error.flatten().fieldErrors
      }
      return NextResponse.json(response, {status: 400})
    }

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }
    return NextResponse.json(response, {status: 500})
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    logger.request({
      method: "GET",
      path: "/api/v1/api-keys"
    })

    const user = await requireSuperAdminApi(request)

    const keys = await apiKeyService.listAllApiKeys()

    const response: ApiResponse = {
      success: true,
      data: keys
    }

    logger.response({
      method: "GET",
      path: "/api/v1/api-keys",
      statusCode: 200,
      duration: Date.now() - startTime,
      response: response,
      userId: user.id
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error({
      message: "Error listing API keys",
      method: "GET",
      path: "/api/v1/api-keys",
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
