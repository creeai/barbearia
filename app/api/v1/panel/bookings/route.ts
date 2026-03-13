import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {bookingService} from "@/lib/services/booking.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const createBookingSchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  slotId: z.string().uuid(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().nullable(),
  customerPhone: z.string().optional().nullable()
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
    const status = searchParams.get("status") || undefined
    const bookings = await bookingService.getAllBookings(user.companyId, {professionalId, status})
    return NextResponse.json({success: true, data: bookings} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    logger.error({message: "Panel GET bookings", error})
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
    const validated = createBookingSchema.parse(body)
    const booking = await bookingService.createBooking({
      companyId: user.companyId,
      professionalId: validated.professionalId,
      serviceId: validated.serviceId,
      slotId: validated.slotId,
      customerName: validated.customerName,
      customerEmail: validated.customerEmail ?? null,
      customerPhone: validated.customerPhone ?? null
    })
    return NextResponse.json({success: true, data: booking} as ApiResponse, {status: 201})
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {success: false, error: "Validation error", errors: error.flatten().fieldErrors} as ApiResponse,
        {status: 400}
      )
    }
    logger.error({message: "Panel POST booking", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
