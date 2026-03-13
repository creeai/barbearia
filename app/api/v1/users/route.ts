import {NextRequest, NextResponse} from "next/server"
import {requireSuperAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {userService} from "@/lib/services/user.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["super_admin", "admin"]),
  companyId: z.string().uuid().nullable()
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    logger.request({
      method: "POST",
      path: "/api/v1/users"
    })

    const user = await requireSuperAdminApi(request)

    const body = await request.json()
    logger.debug({
      message: "Request payload",
      method: "POST",
      path: "/api/v1/users",
      payload: body,
      userId: user.id
    })

    const validated = createUserSchema.parse(body)

    // Validar que admin precisa de companyId
    if (validated.role === "admin" && !validated.companyId) {
      const response: ApiResponse = {
        success: false,
        error: "companyId is required for admin role"
      }
      return NextResponse.json(response, {status: 400})
    }

    const newUser = await userService.createUser({
      email: validated.email,
      name: validated.name,
      role: validated.role,
      companyId: validated.companyId,
      createdBy: user.id
    })

    const response: ApiResponse = {
      success: true,
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        companyId: newUser.company_id
      }
    }

    logger.response({
      method: "POST",
      path: "/api/v1/users",
      statusCode: 201,
      duration: Date.now() - startTime,
      response: response,
      userId: user.id
    })

    return NextResponse.json(response, {status: 201})
  } catch (error) {
    logger.error({
      message: "Error creating user",
      method: "POST",
      path: "/api/v1/users",
      error,
      duration: Date.now() - startTime
    })

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
      path: "/api/v1/users"
    })

    const user = await requireSuperAdminApi(request)

    const users = await userService.listUsers()

    const response: ApiResponse = {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        companyId: u.company_id,
        createdAt: u.created_at,
        isBlocked: (u as {is_blocked?: boolean}).is_blocked ?? false
      }))
    }

    logger.response({
      method: "GET",
      path: "/api/v1/users",
      statusCode: 200,
      duration: Date.now() - startTime,
      response: response,
      userId: user.id
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error({
      message: "Error listing users",
      method: "GET",
      path: "/api/v1/users",
      error,
      duration: Date.now() - startTime
    })

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
