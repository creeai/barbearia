import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {slotService} from "@/lib/services/slot.service"
import {logger} from "@/lib/logger"
import type {ApiResponse} from "@/types/api"

export async function DELETE(
  request: NextRequest,
  {params}: {params: {id: string}}
) {
  try {
    const user = await requireAdminApi(request)
    if (!user.companyId) {
      return NextResponse.json(
        {success: false, error: "Usuário não vinculado a uma barbearia"} as ApiResponse,
        {status: 400}
      )
    }
    const {id} = params
    await slotService.deleteBlockedSlot(id, user.companyId)
    return NextResponse.json({success: true, data: {message: "Horário desbloqueado"}} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof Error && (error.message === "Slot not found" || error.message.includes("doesn't belong"))) {
      return NextResponse.json({success: false, error: "Horário não encontrado"} as ApiResponse, {status: 404})
    }
    if (error instanceof Error && error.message.includes("associated booking")) {
      return NextResponse.json(
        {success: false, error: "Não é possível remover: há um agendamento neste horário"} as ApiResponse,
        {status: 400}
      )
    }
    logger.error({message: "Panel DELETE slot", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
