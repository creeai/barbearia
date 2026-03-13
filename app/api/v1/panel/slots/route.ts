import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {slotService} from "@/lib/services/slot.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const createBlockedSlotSchema = z.object({
  professionalId: z.string().uuid(),
  blockType: z.enum(["specific_date", "day_of_week"]).optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  recurrence: z.enum(["week"]).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  weeks: z.number().int().min(1).max(52).optional()
})

function toIsoIfValid(s: string): string | null {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

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
    if (!professionalId) {
      return NextResponse.json(
        {success: false, error: "professionalId é obrigatório"} as ApiResponse,
        {status: 400}
      )
    }
    let from = searchParams.get("from")
    let to = searchParams.get("to")
    if (!from || !to) {
      const now = new Date()
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
      from = todayStart.toISOString()
      to = new Date(todayStart.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
    }
    const slots = await slotService.getSlotsForPanel({
      companyId: user.companyId,
      professionalId,
      from,
      to
    })
    return NextResponse.json({success: true, data: slots} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    logger.error({message: "Panel GET slots", error})
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
    const validated = createBlockedSlotSchema.parse(body)
    const blockType = validated.blockType ?? "specific_date"

    if (blockType === "day_of_week") {
      if (validated.dayOfWeek === undefined) {
        return NextResponse.json(
          {success: false, error: "dayOfWeek é obrigatório para bloqueio por dia da semana"} as ApiResponse,
          {status: 400}
        )
      }
      const timeRegex = /^\d{1,2}:\d{2}$/
      if (!timeRegex.test(validated.startTime) || !timeRegex.test(validated.endTime)) {
        return NextResponse.json(
          {success: false, error: "startTime e endTime devem ser no formato HH:mm"} as ApiResponse,
          {status: 400}
        )
      }
      const slots = await slotService.createBlockedSlotsForDayOfWeek({
        companyId: user.companyId,
        professionalId: validated.professionalId,
        dayOfWeek: validated.dayOfWeek,
        startTime: validated.startTime,
        endTime: validated.endTime,
        weeks: validated.weeks ?? 12
      })
      return NextResponse.json({success: true, data: slots} as ApiResponse, {status: 201})
    }

    const startIso = toIsoIfValid(validated.startTime)
    const endIso = toIsoIfValid(validated.endTime)
    if (!startIso || !endIso) {
      return NextResponse.json(
        {success: false, error: "startTime e endTime devem ser datas/horários válidos"} as ApiResponse,
        {status: 400}
      )
    }
    if (validated.recurrence === "week") {
      const slots = await slotService.createBlockedSlotsForWeek({
        companyId: user.companyId,
        professionalId: validated.professionalId,
        startTime: startIso,
        endTime: endIso
      })
      return NextResponse.json({success: true, data: slots} as ApiResponse, {status: 201})
    }
    const slot = await slotService.createBlockedSlot({
      companyId: user.companyId,
      professionalId: validated.professionalId,
      startTime: startIso,
      endTime: endIso
    })
    return NextResponse.json({success: true, data: slot} as ApiResponse, {status: 201})
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {success: false, error: "Validation error", errors: error.flatten().fieldErrors} as ApiResponse,
        {status: 400}
      )
    }
    logger.error({message: "Panel POST blocked slot", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
