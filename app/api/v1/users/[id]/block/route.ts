import {NextRequest, NextResponse} from "next/server"
import {requireSuperAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {userService} from "@/lib/services/user.service"
import {logger} from "@/lib/logger"
import type {ApiResponse} from "@/types/api"

export async function PATCH(
  _request: NextRequest,
  {params}: {params: Promise<{id: string}>}
) {
  const startTime = Date.now()
  const {id} = await params

  try {
    logger.request({
      method: "PATCH",
      path: "/api/v1/users/[id]/block",
      userId: id
    })

    const user = await requireSuperAdminApi(_request)

    await userService.blockUser(id, user.id)

    const response: ApiResponse = {
      success: true,
      data: {blocked: true}
    }

    logger.response({
      method: "PATCH",
      path: "/api/v1/users/[id]/block",
      statusCode: 200,
      duration: Date.now() - startTime,
      response: response,
      userId: user.id
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error({
      message: "Error blocking user",
      method: "PATCH",
      path: "/api/v1/users/[id]/block",
      error,
      userId: id,
      duration: Date.now() - startTime
    })

    if (error instanceof ApiAuthError) {
      return error.toResponse()
    }

    const message = error instanceof Error ? error.message : "Internal server error"
    const response: ApiResponse = {
      success: false,
      error: message
    }
    return NextResponse.json(response, {status: 400})
  }
}
