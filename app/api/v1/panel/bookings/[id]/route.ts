import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {bookingService} from "@/lib/services/booking.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const updateBookingSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional()
})

export async function GET(
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
    const booking = await bookingService.getBookingById(id, user.companyId)
    return NextResponse.json({success: true, data: booking} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof Error && error.message === "Booking not found") {
      return NextResponse.json({success: false, error: "Agendamento não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel GET booking", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}

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
    const validated = updateBookingSchema.parse(body)
    const booking = await bookingService.updateBooking(id, user.companyId, validated)
    return NextResponse.json({success: true, data: booking} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {success: false, error: "Validation error", errors: error.flatten().fieldErrors} as ApiResponse,
        {status: 400}
      )
    }
    if (error instanceof Error && error.message === "Booking not found") {
      return NextResponse.json({success: false, error: "Agendamento não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel PUT booking", error})
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
    await bookingService.deleteBooking(id, user.companyId)
    return NextResponse.json({success: true, data: {message: "Agendamento excluído"}} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof Error && error.message === "Booking not found") {
      return NextResponse.json({success: false, error: "Agendamento não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel DELETE booking", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
