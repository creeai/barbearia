import {createServiceClient} from "@/lib/supabase/server"
import {logger} from "@/lib/logger"
import {activityLogService} from "./activity-log.service"

export interface CreateBookingParams {
  companyId: string
  professionalId: string
  serviceId: string
  slotId: string
  customerName: string
  customerEmail?: string | null
  customerPhone?: string | null
}

export interface UpdateBookingParams {
  customerName?: string
  customerEmail?: string | null
  customerPhone?: string | null
  status?: string
}

export class BookingService {
  async createBooking(params: CreateBookingParams) {
    const supabase = await createServiceClient()

    // Usar a função RPC create_booking_safely para garantir atomicidade
    const {data: bookingId, error} = await supabase.rpc("create_booking_safely", {
      p_company_id: params.companyId,
      p_professional_id: params.professionalId,
      p_service_id: params.serviceId,
      p_slot_id: params.slotId,
      p_customer_name: params.customerName,
      p_customer_email: params.customerEmail || null,
      p_customer_phone: params.customerPhone || null
    })

    if (error || !bookingId) {
      logger.error({
        message: "Failed to create booking",
        error,
        companyId: params.companyId,
        slotId: params.slotId
      })
      throw new Error(error?.message || "Failed to create booking")
    }

    // Buscar o booking criado
    const {data: booking, error: fetchError} = await supabase.from("bookings").select("*").eq("id", bookingId).single()

    if (fetchError || !booking) {
      logger.error({
        message: "Failed to fetch created booking",
        error: fetchError,
        bookingId
      })
      throw new Error("Failed to fetch created booking")
    }

    await activityLogService.log({
      companyId: params.companyId,
      action: "booking_created",
      resourceType: "booking",
      resourceId: booking.id,
      metadata: {
        professionalId: params.professionalId,
        serviceId: params.serviceId,
        slotId: params.slotId,
        customerName: params.customerName
      }
    })

    logger.info({
      message: "Booking created successfully",
      bookingId: booking.id,
      companyId: params.companyId
    })

    return booking
  }

  async getAllBookings(companyId: string, filters?: {professionalId?: string; status?: string}) {
    const supabase = await createServiceClient()

    let query = supabase
      .from("bookings")
      .select("*, slots!slot_id(start_time, end_time)")
      .eq("company_id", companyId)

    if (filters?.professionalId) {
      query = query.eq("professional_id", filters.professionalId)
    }

    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    const {data, error} = await query.order("created_at", {ascending: false})

    if (error) {
      logger.error({
        message: "Failed to get bookings",
        error,
        companyId,
        filters
      })
      throw new Error("Failed to get bookings")
    }

    const rows = data || []
    return rows.map((row: Record<string, unknown>) => {
      const slots = row.slots as {start_time?: string; end_time?: string} | null | undefined
      const slot = Array.isArray(slots) ? slots[0] : slots
      return {
        ...row,
        slot_start_time: slot?.start_time ?? null,
        slot_end_time: slot?.end_time ?? null,
        slots: undefined
      }
    })
  }

  async getBookingById(id: string, companyId: string) {
    const supabase = await createServiceClient()

    const {data, error} = await supabase.from("bookings").select("*").eq("id", id).eq("company_id", companyId).single()

    if (error || !data) {
      logger.error({
        message: "Booking not found",
        error,
        bookingId: id,
        companyId
      })
      throw new Error("Booking not found")
    }

    return data
  }

  async updateBooking(id: string, companyId: string, params: UpdateBookingParams) {
    const supabase = await createServiceClient()

    // Verificar se o booking existe e pertence à company
    await this.getBookingById(id, companyId)

    const updateData: any = {}
    if (params.customerName !== undefined) updateData.customer_name = params.customerName
    if (params.customerEmail !== undefined) updateData.customer_email = params.customerEmail
    if (params.customerPhone !== undefined) updateData.customer_phone = params.customerPhone
    if (params.status !== undefined) updateData.status = params.status

    const {data, error} = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single()

    if (error || !data) {
      logger.error({
        message: "Failed to update booking",
        error,
        bookingId: id,
        companyId
      })
      throw new Error("Failed to update booking")
    }

    await activityLogService.log({
      companyId,
      action: "booking_updated",
      resourceType: "booking",
      resourceId: id,
      metadata: updateData
    })

    logger.info({
      message: "Booking updated successfully",
      bookingId: id,
      companyId
    })

    return data
  }

  async deleteBooking(id: string, companyId: string) {
    const supabase = await createServiceClient()

    // Verificar se o booking existe e pertence à company
    const booking = await this.getBookingById(id, companyId)

    // Marcar o slot como disponível novamente antes de deletar
    const {error: slotError} = await supabase.from("slots").update({is_available: true}).eq("id", booking.slot_id)

    if (slotError) {
      logger.warn({
        message: "Failed to mark slot as available",
        error: slotError,
        slotId: booking.slot_id
      })
      // Não falhar a deleção se não conseguir marcar o slot como disponível
    }

    const {error} = await supabase.from("bookings").delete().eq("id", id).eq("company_id", companyId)

    if (error) {
      logger.error({
        message: "Failed to delete booking",
        error,
        bookingId: id,
        companyId
      })
      throw new Error("Failed to delete booking")
    }

    await activityLogService.log({
      companyId,
      action: "booking_deleted",
      resourceType: "booking",
      resourceId: id
    })

    logger.info({
      message: "Booking deleted successfully",
      bookingId: id,
      companyId
    })
  }
}

export const bookingService = new BookingService()
