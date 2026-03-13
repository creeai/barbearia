import {NextRequest, NextResponse} from "next/server"
import {requireSuperAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {companyService} from "@/lib/services/company.service"
import {logger} from "@/lib/logger"
import type {ApiResponse} from "@/types/api"

export async function DELETE(
  _request: NextRequest,
  {params}: {params: Promise<{id: string}>}
) {
  const startTime = Date.now()
  const {id} = await params

  try {
    logger.request({
      method: "DELETE",
      path: "/api/v1/companies/[id]",
      companyId: id
    })

    const user = await requireSuperAdminApi(_request)

    await companyService.deleteCompany(id, user.id)

    const response: ApiResponse = {
      success: true,
      data: {deleted: true}
    }

    logger.response({
      method: "DELETE",
      path: "/api/v1/companies/[id]",
      statusCode: 200,
      duration: Date.now() - startTime,
      response: response,
      userId: user.id
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error({
      message: "Error deleting company",
      method: "DELETE",
      path: "/api/v1/companies/[id]",
      error,
      companyId: id,
      duration: Date.now() - startTime
    })

    if (error instanceof ApiAuthError) {
      return error.toResponse()
    }

    const message = error instanceof Error ? error.message : "Internal server error"
    const status = message.includes("vinculados") ? 409 : 500
    const response: ApiResponse = {
      success: false,
      error: message
    }
    return NextResponse.json(response, {status})
  }
}
