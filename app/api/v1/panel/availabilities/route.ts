import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {availabilityService} from "@/lib/services/availability.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const createAvailabilitySchema = z.object({
  professionalId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/)
})

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
    const professionalId = searchParams.get("professionalId") || undefined
    const availabilities = await availabilityService.getAllAvailabilities(user.companyId, professionalId)
    return NextResponse.json({success: true, data: availabilities} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    logger.error({message: "Panel GET availabilities", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminApi(request)
    if (!user.companyId) {
      return NextResponse.json(
        {success: false, error: "Usuário não vinculado a uma barbearia"} as ApiResponse,
        {status: 400}
      )
    }
    const body = await request.json()
    const validated = createAvailabilitySchema.parse(body)
    const availability = await availabilityService.createAvailability({
      professionalId: validated.professionalId,
      dayOfWeek: validated.dayOfWeek,
      startTime: validated.startTime,
      endTime: validated.endTime
    })
    return NextResponse.json({success: true, data: availability} as ApiResponse, {status: 201})
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {success: false, error: "Validation error", errors: error.flatten().fieldErrors} as ApiResponse,
        {status: 400}
      )
    }
    logger.error({message: "Panel POST availability", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
