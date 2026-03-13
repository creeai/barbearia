import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {slotService} from "@/lib/services/slot.service"
import {logger} from "@/lib/logger"
import type {ApiResponse} from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdminApi(request)
    if (!user.companyId) {
      return NextResponse.json(
        {success: false, error: "Usuário não vinculado a uma barbearia"} as ApiResponse,
        {status: 400}
      )
    }
    const {searchParams} = new URL(request.url)
    const professionalId = searchParams.get("professionalId")
    const serviceId = searchParams.get("serviceId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    if (!professionalId || !serviceId || !from || !to) {
      return NextResponse.json(
        {success: false, error: "professionalId, serviceId, from e to são obrigatórios"} as ApiResponse,
        {status: 400}
      )
    }
    const result = await slotService.getServiceWindows({
      professionalId,
      serviceId,
      from,
      to,
      companyId: user.companyId
    })
    return NextResponse.json({success: true, data: result} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    logger.error({message: "Panel GET available slots", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
