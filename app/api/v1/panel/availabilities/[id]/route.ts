import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {availabilityService} from "@/lib/services/availability.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const updateAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional()
})

export async function PUT(
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
    const body = await request.json()
    const validated = updateAvailabilitySchema.parse(body)
    const updateData: {dayOfWeek?: number; startTime?: string; endTime?: string} = {}
    if (validated.dayOfWeek !== undefined) updateData.dayOfWeek = validated.dayOfWeek
    if (validated.startTime !== undefined) updateData.startTime = validated.startTime
    if (validated.endTime !== undefined) updateData.endTime = validated.endTime
    const availability = await availabilityService.updateAvailability(id, user.companyId, updateData)
    return NextResponse.json({success: true, data: availability} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {success: false, error: "Validation error", errors: error.flatten().fieldErrors} as ApiResponse,
        {status: 400}
      )
    }
    if (error instanceof Error && error.message === "Availability not found") {
      return NextResponse.json({success: false, error: "Disponibilidade não encontrada"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel PUT availability", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}

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
    await availabilityService.deleteAvailability(id, user.companyId)
    return NextResponse.json({success: true, data: {message: "Disponibilidade excluída"}} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof Error && error.message === "Availability not found") {
      return NextResponse.json({success: false, error: "Disponibilidade não encontrada"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel DELETE availability", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
