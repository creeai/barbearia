import {createServiceClient} from "@/lib/supabase/server"
import {logger} from "@/lib/logger"
import { serviceService } from "./service.service"
import { buildServiceWindowsFromBaseSlots } from "./slot-windows.util"
import { availabilityService } from "./availability.service"
import { DateTime } from 'luxon'

export interface GetSlotsParams {
  professionalId: string
  serviceId?: string
  from: string // ISO date string
  to: string // ISO date string
  companyId: string
}

export interface Slot {
  id: string
  professional_id: string
  service_id: string | null
  start_time: string
  end_time: string
  is_available: boolean
}

export interface ServiceWindowParams {
  professionalId: string
  serviceId: string
  from: string
  to: string
  companyId: string
  slotStepMinutes?: number
  minLeadMinutes?: number
  closingTime?: string
  timezone?: string
}

export interface ServiceWindowsResult {
  service: any
  slots: Array<{ start_time: string; end_time: string; label?: string; slot_ids: string[] }>
}

export class SlotService {
  async getAvailableSlots(params: GetSlotsParams): Promise<Slot[]> {
    const supabase = await createServiceClient()

    // Verificar se o professional pertence à company
    const {data: professional} = await supabase
      .from("professionals")
      .select("id")
      .eq("id", params.professionalId)
      .eq("company_id", params.companyId)
      .single()

    if (!professional) {
      throw new Error("Professional not found or doesn't belong to company")
    }

    // Buscar slots disponíveis
    let query = supabase
      .from("slots")
      .select("*")
      .eq("professional_id", params.professionalId)
      .eq("is_available", true)
      .gte("start_time", params.from)
      .lte("start_time", params.to)
      .order("start_time", {ascending: true})

    if (params.serviceId) {
      query = query.or(`service_id.eq.${params.serviceId},service_id.is.null`)
    }

    const {data, error} = await query

    if (error) {
      logger.error({
        message: "Failed to get slots",
        error,
        professionalId: params.professionalId,
        companyId: params.companyId
      })
      throw new Error("Failed to get slots")
    }

    // Se há slots na base de dados, retornar
    if (data && data.length > 0) {
      logger.debug({
        message: "Found slots in database",
        count: data.length,
        professionalId: params.professionalId
      })
      return data
    }

    // Se não há slots, gerar dinamicamente a partir das availabilities
    logger.debug({
      message: "No slots found in database, generating from availabilities",
      professionalId: params.professionalId
    })

    return await this.generateSlotsFromAvailabilities(params)
  }

  private async generateSlotsFromAvailabilities(params: GetSlotsParams): Promise<Slot[]> {
    const slotStepMinutes = 15 // Default slot step

    // Buscar availabilities do profissional
    const availabilities = await availabilityService.getAllAvailabilities(
      params.companyId,
      params.professionalId
    )

    logger.debug({
      message: "Availabilities fetched",
      count: availabilities?.length || 0,
      availabilities: availabilities?.map(av => ({
        day_of_week: av.day_of_week,
        start_time: av.start_time,
        end_time: av.end_time
      })),
      professionalId: params.professionalId
    })

    if (!availabilities || availabilities.length === 0) {
      logger.debug({
        message: "No availabilities found for professional",
        professionalId: params.professionalId
      })
      return []
    }

    const timezone = 'America/Sao_Paulo' // Default timezone
    const fromDt = DateTime.fromISO(params.from, { zone: 'utc' }).setZone(timezone)
    const toDt = DateTime.fromISO(params.to, { zone: 'utc' }).setZone(timezone)
    const generatedSlots: Slot[] = []

    logger.debug({
      message: "Date range for slot generation",
      from: fromDt.toISO(),
      to: toDt.toISO(),
      fromLocal: fromDt.toFormat('yyyy-MM-dd HH:mm'),
      toLocal: toDt.toFormat('yyyy-MM-dd HH:mm'),
      timezone
    })

    // Gerar slots para cada dia no intervalo
    let currentDate = fromDt.startOf('day')
    const endDate = toDt.startOf('day')

    while (currentDate <= endDate) {
      // Luxon weekday: 1=Monday, 2=Tuesday, ..., 7=Sunday
      // Sistema: 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
      const luxonWeekday = currentDate.weekday // 1-7
      // Converter: Luxon 7 (Sunday) -> Sistema 0, Luxon 1-6 -> Sistema 1-6
      const dayOfWeek = luxonWeekday === 7 ? 0 : luxonWeekday
      
      logger.debug({
        message: "Processing day",
        date: currentDate.toFormat('yyyy-MM-dd'),
        luxonWeekday,
        dayOfWeek,
        dayName: currentDate.toFormat('cccc')
      })
      
      // Encontrar availability para este dia da semana
      const availability = availabilities.find(av => av.day_of_week === dayOfWeek)
      
      if (availability) {
        const [startHour, startMinute] = availability.start_time.split(':').map(Number)
        const [endHour, endMinute] = availability.end_time.split(':').map(Number)
        
        const dayStart = currentDate.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 })
        const dayEnd = currentDate.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 })
        
        logger.debug({
          message: "Found availability for day",
          date: currentDate.toFormat('yyyy-MM-dd'),
          dayOfWeek,
          availabilityStart: availability.start_time,
          availabilityEnd: availability.end_time,
          dayStart: dayStart.toFormat('yyyy-MM-dd HH:mm'),
          dayEnd: dayEnd.toFormat('yyyy-MM-dd HH:mm')
        })
        
        // Gerar slots de slotStepMinutes em slotStepMinutes
        let slotStart = dayStart
        let slotCount = 0
        while (slotStart < dayEnd) {
          const slotEnd = slotStart.plus({ minutes: slotStepMinutes })
          
          // Verificar se o slot está dentro do intervalo solicitado (usando UTC para comparação)
          const slotStartUtc = slotStart.toUTC()
          const fromDtUtc = fromDt.toUTC()
          const toDtUtc = toDt.toUTC()
          
          if (slotStartUtc >= fromDtUtc && slotStartUtc <= toDtUtc) {
            const slotStartIso = slotStartUtc.toISO()
            const slotEndIso = slotEnd.toUTC().toISO()
            
            if (slotStartIso && slotEndIso) {
              // Criar slot virtual (não salvo na base)
              generatedSlots.push({
                id: `virtual-${slotStartIso}`, // ID virtual para slots gerados
                professional_id: params.professionalId,
                service_id: params.serviceId || null,
                start_time: slotStartIso,
                end_time: slotEndIso,
                is_available: true
              })
              slotCount++
            }
          }
          
          slotStart = slotEnd
        }
        
        logger.debug({
          message: "Generated slots for day",
          date: currentDate.toFormat('yyyy-MM-dd'),
          slotCount
        })
      } else {
        logger.debug({
          message: "No availability for day",
          date: currentDate.toFormat('yyyy-MM-dd'),
          dayOfWeek
        })
      }
      
      currentDate = currentDate.plus({ days: 1 })
    }

    logger.debug({
      message: "Generated slots from availabilities",
      totalCount: generatedSlots.length,
      professionalId: params.professionalId,
      sampleSlots: generatedSlots.slice(0, 3).map(s => ({
        start_time: s.start_time,
        end_time: s.end_time
      }))
    })

    return generatedSlots
  }

  private async generateServiceSlotsDirectly(params: {
    professionalId: string
    serviceId: string
    duration: number
    from: string
    to: string
    companyId: string
    timezone: string
    closingTime: string
    occupiedStartTimes: Set<string>
    minLeadMinutes: number
  }): Promise<Array<{ start_time: string; end_time: string; slot_ids: string[] }>> {
    // Buscar availabilities do profissional
    const availabilities = await availabilityService.getAllAvailabilities(
      params.companyId,
      params.professionalId
    )

    if (!availabilities || availabilities.length === 0) {
      return []
    }

    const fromDt = DateTime.fromISO(params.from, { zone: 'utc' }).setZone(params.timezone)
    const toDt = DateTime.fromISO(params.to, { zone: 'utc' }).setZone(params.timezone)
    const nowDt = DateTime.now().setZone(params.timezone)
    const nowWithLead = nowDt.plus({ minutes: params.minLeadMinutes })
    
    const windows: Array<{ start_time: string; end_time: string; slot_ids: string[] }> = []
    const [closingHour, closingMinute] = params.closingTime.split(':').map(Number)

    // Gerar slots para cada dia no intervalo
    let currentDate = fromDt.startOf('day')
    const endDate = toDt.startOf('day')

    while (currentDate <= endDate) {
      // Luxon weekday: 1=Monday, 2=Tuesday, ..., 7=Sunday
      // Sistema: 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
      const luxonWeekday = currentDate.weekday
      const dayOfWeek = luxonWeekday === 7 ? 0 : luxonWeekday
      
      // Encontrar availability para este dia da semana
      const availability = availabilities.find(av => av.day_of_week === dayOfWeek)
      
      if (availability) {
        const [startHour, startMinute] = availability.start_time.split(':').map(Number)
        const [endHour, endMinute] = availability.end_time.split(':').map(Number)
        
        const dayStart = currentDate.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 })
        const dayEnd = currentDate.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 })
        const dayClosing = currentDate.set({ hour: closingHour, minute: closingMinute, second: 0, millisecond: 0 })
        
        // Gerar slots diretamente com a duração do serviço
        let slotStart = dayStart
        
        while (slotStart < dayEnd) {
          const slotEnd = slotStart.plus({ minutes: params.duration })
          
          // Verificar se o slot termina antes do horário de fechamento
          if (slotEnd > dayClosing) {
            break
          }
          
          // Verificar se o slot está dentro do intervalo solicitado
          const slotStartUtc = slotStart.toUTC()
          if (slotStartUtc >= fromDt.toUTC() && slotStartUtc <= toDt.toUTC()) {
            // Verificar se não está no passado (com lead time)
            // Se for no mesmo dia, verificar se está no futuro com arredondamento
            let isFuture = true
            
            if (slotStart.hasSame(nowWithLead, 'day')) {
              // Mesmo dia: verificar se está no futuro
              isFuture = slotStart >= nowWithLead
            } else {
              // Dia diferente: verificar se é futuro
              isFuture = slotStart > nowWithLead
            }
            
            if (isFuture) {
              const slotStartIso = slotStartUtc.toISO()
              
              // Verificar se não está ocupado
              if (slotStartIso && !params.occupiedStartTimes.has(slotStartIso)) {
                const slotEndIso = slotEnd.toUTC().toISO()
                if (slotEndIso) {
                  windows.push({
                    start_time: slotStartIso,
                    end_time: slotEndIso,
                    slot_ids: [`virtual-${slotStartIso}`]
                  })
                }
              }
            }
          }
          
          // Avançar pela duração do serviço (sem sobreposição)
          slotStart = slotEnd
        }
      }
      
      currentDate = currentDate.plus({ days: 1 })
    }

    return windows
  }

  async getServiceWindows(params: ServiceWindowParams): Promise<ServiceWindowsResult> {
    const supabase = await createServiceClient()

    // verify professional
    const {data: professional} = await supabase
      .from("professionals")
      .select("id")
      .eq("id", params.professionalId)
      .eq("company_id", params.companyId)
      .single()

    if (!professional) {
      throw new Error("Professional not found or doesn't belong to company")
    }

    // fetch service (will throw if not found)
    const service = await serviceService.getServiceById(params.serviceId, params.companyId)

    const duration = (service as any).duration_minutes
    if (duration === null || duration === undefined) {
      const err = new Error("Service duration missing")
      ;(err as any).status = 422
      throw err
    }

    const slotStep = params.slotStepMinutes || 15
    const timezone = params.timezone || 'America/Sao_Paulo'
    
    // Se closingTime não foi fornecido, buscar das availabilities
    let closingTime = params.closingTime
    if (!closingTime) {
      const availabilities = await availabilityService.getAllAvailabilities(
        params.companyId,
        params.professionalId
      )
      // Usar o maior horário de fechamento encontrado
      if (availabilities && availabilities.length > 0) {
        const maxEndTime = availabilities.reduce((max, av) => {
          return av.end_time > max ? av.end_time : max
        }, availabilities[0].end_time)
        closingTime = maxEndTime
      } else {
        closingTime = '18:00' // Default
      }
    }

    logger.debug({
      message: "Building service windows",
      professionalId: params.professionalId,
      serviceId: params.serviceId,
      duration,
      slotStep,
      closingTime,
      timezone,
      from: params.from,
      to: params.to
    })

    // Buscar slots ocupados na base de dados (para marcar como indisponíveis)
    const {data: occupiedSlots} = await supabase
      .from("slots")
      .select("start_time, end_time, is_available")
      .eq("professional_id", params.professionalId)
      .eq("is_available", false)
      .gte("start_time", params.from)
      .lte("start_time", params.to)

    const occupiedStartTimes = new Set(
      (occupiedSlots || []).map(s => s.start_time)
    )

    logger.debug({
      message: "Occupied slots from database",
      count: occupiedSlots?.length || 0
    })

    // Buscar slots disponíveis no banco de dados para usar IDs reais
    const {data: availableSlots} = await supabase
      .from("slots")
      .select("id, start_time, end_time, is_available")
      .eq("professional_id", params.professionalId)
      .eq("is_available", true)
      .gte("start_time", params.from)
      .lte("start_time", params.to)

    // Criar mapa de start_time normalizado -> slot_id para slots reais
    // Normalizar timestamps para comparar corretamente (pode vir como +00:00 ou .000Z)
    // Usar múltiplas chaves para garantir que encontramos a correspondência
    const realSlotIds = new Map<string, string>()
    if (availableSlots) {
      for (const slot of availableSlots) {
        try {
          // Normalizar o timestamp para formato ISO padrão (UTC)
          const slotDt = DateTime.fromISO(slot.start_time, {zone: 'utc'})
          const normalizedTime = slotDt.toUTC().toISO()
          
          if (normalizedTime) {
            // Adicionar com formato normalizado
            realSlotIds.set(normalizedTime, slot.id)
            // Também adicionar sem milissegundos caso o formato seja diferente
            const withoutMs = normalizedTime.replace(/\.\d{3}Z$/, 'Z')
            if (withoutMs !== normalizedTime) {
              realSlotIds.set(withoutMs, slot.id)
            }
          }
          // Também adicionar o formato original caso seja diferente
          realSlotIds.set(slot.start_time, slot.id)
        } catch (e) {
          // Se houver erro ao parsear, usar o formato original
          realSlotIds.set(slot.start_time, slot.id)
        }
      }
    }

    logger.debug({
      message: "Available slots from database",
      count: availableSlots?.length || 0,
      mapSize: realSlotIds.size,
      sampleSlots: availableSlots?.slice(0, 3).map(s => ({
        id: s.id,
        start_time: s.start_time,
        normalized: DateTime.fromISO(s.start_time, {zone: 'utc'}).toUTC().toISO()
      }))
    })

    // Gerar slots diretamente com a duração do serviço (sem sobreposição)
    logger.debug({
      message: "Generating service slots directly with duration",
      professionalId: params.professionalId,
      duration
    })
    
    const windows = await this.generateServiceSlotsDirectly({
      professionalId: params.professionalId,
      serviceId: params.serviceId,
      duration,
      from: params.from,
      to: params.to,
      companyId: params.companyId,
      timezone,
      closingTime: closingTime ?? "18:00",
      occupiedStartTimes,
      minLeadMinutes: params.minLeadMinutes || 0
    })

    // Mapear IDs reais aos slots gerados quando existirem
    // Normalizar o start_time do slot gerado para comparar com os do banco
    const windowsWithRealIds = windows.map(w => {
      try {
        // Normalizar o timestamp gerado para comparar
        const generatedDt = DateTime.fromISO(w.start_time, {zone: 'utc'})
        const normalizedGeneratedTime = generatedDt.toUTC().toISO()
        
        // Tentar encontrar ID real usando múltiplos formatos
        let realId: string | undefined
        
        if (normalizedGeneratedTime) {
          // Tentar formato completo primeiro (mais comum)
          realId = realSlotIds.get(normalizedGeneratedTime)
          
          // Se não encontrou, tentar sem milissegundos
          if (!realId) {
            const withoutMs = normalizedGeneratedTime.replace(/\.\d{3}Z$/, 'Z')
            realId = realSlotIds.get(withoutMs)
          }
          
          // Se ainda não encontrou, tentar formato com +00:00
          if (!realId) {
            const withOffset = normalizedGeneratedTime.replace('Z', '+00:00')
            realId = realSlotIds.get(withOffset)
          }
          
          // Tentar também sem milissegundos e com +00:00
          if (!realId) {
            const withoutMsWithOffset = normalizedGeneratedTime.replace(/\.\d{3}Z$/, '+00:00')
            realId = realSlotIds.get(withoutMsWithOffset)
          }
        }
        
        // Última tentativa: formato original
        if (!realId) {
          realId = realSlotIds.get(w.start_time)
        }
        
        if (realId) {
          return {
            ...w,
            slot_ids: [realId]
          }
        }
      } catch (e) {
        // Se houver erro, tentar formato original
        const realId = realSlotIds.get(w.start_time)
        if (realId) {
          return {
            ...w,
            slot_ids: [realId]
          }
        }
      }
      
      return w
    })

    // Identificar slots virtuais que precisam ser criados no banco
    const virtualSlots = windowsWithRealIds.filter(w => 
      w.slot_ids && w.slot_ids.length > 0 && w.slot_ids[0].startsWith('virtual-')
    )

    // Criar slots no banco de dados para os slots virtuais
    if (virtualSlots.length > 0) {
      logger.debug({
        message: "Creating virtual slots in database",
        count: virtualSlots.length
      })

      const slotsToCreate = virtualSlots.map(w => ({
        professional_id: params.professionalId,
        service_id: params.serviceId,
        start_time: w.start_time,
        end_time: w.end_time,
        is_available: true
      }))

      // Coletar todos os start_times para buscar slots existentes
      const startTimes = virtualSlots.map(w => w.start_time)

      // Buscar slots existentes primeiro (para evitar duplicatas)
      const {data: existingSlots} = await supabase
        .from("slots")
        .select("id, start_time")
        .eq("professional_id", params.professionalId)
        .in("start_time", startTimes)

      // Criar mapa de slots existentes
      const existingSlotIds = new Map<string, string>()
      if (existingSlots) {
        for (const slot of existingSlots) {
          const normalizedTime = DateTime.fromISO(slot.start_time, {zone: 'utc'}).toUTC().toISO()
          if (normalizedTime) {
            existingSlotIds.set(normalizedTime, slot.id)
          }
          existingSlotIds.set(slot.start_time, slot.id)
        }
      }

      // Filtrar apenas slots que não existem
      const slotsToInsert = slotsToCreate.filter(slot => {
        const normalizedTime = DateTime.fromISO(slot.start_time, {zone: 'utc'}).toUTC().toISO()
        return !(normalizedTime ? existingSlotIds.has(normalizedTime) : existingSlotIds.has(slot.start_time))
      })

      let createdSlots: any[] = []

      // Inserir apenas slots que não existem
      if (slotsToInsert.length > 0) {
        const {data: insertedSlots, error: createError} = await supabase
          .from("slots")
          .insert(slotsToInsert)
          .select("id, start_time")

        if (createError) {
          logger.error({
            message: "Failed to create slots in database",
            error: createError
          })
        } else if (insertedSlots) {
          createdSlots = insertedSlots
        }
      }

      // Combinar slots existentes e criados
      const allSlotIds = new Map<string, string>()
      
      // Adicionar slots existentes
      for (const [key, value] of existingSlotIds.entries()) {
        allSlotIds.set(key, value)
      }
      
      // Adicionar slots criados
      for (const slot of createdSlots) {
        const normalizedTime = DateTime.fromISO(slot.start_time, {zone: 'utc'}).toUTC().toISO()
        if (normalizedTime) {
          allSlotIds.set(normalizedTime, slot.id)
        }
        allSlotIds.set(slot.start_time, slot.id)
      }

      // Atualizar windows com IDs reais (existentes ou criados)
      for (let i = 0; i < windowsWithRealIds.length; i++) {
        const w = windowsWithRealIds[i]
        if (w.slot_ids && w.slot_ids.length > 0 && w.slot_ids[0].startsWith('virtual-')) {
          const normalizedTime = DateTime.fromISO(w.start_time, {zone: 'utc'}).toUTC().toISO()
          const realId = normalizedTime 
            ? allSlotIds.get(normalizedTime) || allSlotIds.get(w.start_time)
            : allSlotIds.get(w.start_time)
          
          if (realId) {
            windowsWithRealIds[i] = {
              ...w,
              slot_ids: [realId]
            }
          }
        }
      }

      logger.debug({
        message: "Slots processed",
        existing: existingSlots?.length || 0,
        created: createdSlots.length,
        total: allSlotIds.size
      })
    }

    // Contar quantos slots receberam IDs reais
    const slotsWithRealIds = windowsWithRealIds.filter(w => 
      w.slot_ids && w.slot_ids.length > 0 && !w.slot_ids[0].startsWith('virtual-')
    )
    const realIdsAssigned = slotsWithRealIds.length

    logger.debug({
      message: "Service slots generated",
      windowsCount: windowsWithRealIds.length,
      realIdsInMap: realSlotIds.size,
      realIdsAssigned,
      slotsWithRealIds: slotsWithRealIds.slice(0, 10).map(w => ({
        start_time: w.start_time,
        slot_id: w.slot_ids[0]
      })),
      sampleWindows: windowsWithRealIds.slice(0, 5).map(w => ({
        start_time: w.start_time,
        end_time: w.end_time,
        slot_ids: w.slot_ids,
        isRealId: w.slot_ids && w.slot_ids.length > 0 && !w.slot_ids[0].startsWith('virtual-')
      }))
    })

    // add simple label in pt-BR short format
    const labeled = windowsWithRealIds.map(w => ({
      ...w,
      label:
        DateTime.fromISO(w.start_time)
          .setZone(timezone)
          .setLocale("pt-BR")
          .toFormat("ccc dd/MM HH:mm") +
        " – " +
        DateTime.fromISO(w.end_time)
          .setZone(timezone)
          .setLocale("pt-BR")
          .toFormat("HH:mm")
    }))

    return {
      service,
      slots: labeled
    }
  }

  /**
   * Cria um slot bloqueado (horário indisponível) para o painel da barbearia.
   * Usado quando o admin bloqueia um horário específico.
   */
  async createBlockedSlot(params: {
    companyId: string
    professionalId: string
    startTime: string // ISO
    endTime: string // ISO
  }): Promise<Slot> {
    const supabase = await createServiceClient()

    const {data: professional} = await supabase
      .from("professionals")
      .select("id")
      .eq("id", params.professionalId)
      .eq("company_id", params.companyId)
      .single()

    if (!professional) {
      throw new Error("Professional not found or doesn't belong to company")
    }

    const {data, error} = await supabase
      .from("slots")
      .insert({
        professional_id: params.professionalId,
        service_id: null,
        start_time: params.startTime,
        end_time: params.endTime,
        is_available: false
      })
      .select()
      .single()

    if (error || !data) {
      logger.error({
        message: "Failed to create blocked slot",
        error,
        professionalId: params.professionalId,
        companyId: params.companyId
      })
      throw new Error("Failed to create blocked slot")
    }

    return data
  }

  /**
   * Cria slots bloqueados para todos os 7 dias da semana (mesmo horário em cada dia).
   * Usa a data de startTime para definir a semana (dia 0 a dia 6 a partir dessa data).
   */
  async createBlockedSlotsForWeek(params: {
    companyId: string
    professionalId: string
    startTime: string
    endTime: string
  }): Promise<Slot[]> {
    const timezone = "America/Sao_Paulo"
    const startDt = DateTime.fromISO(params.startTime, {zone: "utc"}).setZone(timezone)
    const endDt = DateTime.fromISO(params.endTime, {zone: "utc"}).setZone(timezone)
    const startHour = startDt.hour
    const startMinute = startDt.minute
    const endHour = endDt.hour
    const endMinute = endDt.minute
    const results: Slot[] = []
    for (let i = 0; i < 7; i++) {
      const day = startDt.plus({days: i})
      const dayStart = day.set({hour: startHour, minute: startMinute, second: 0, millisecond: 0})
      const dayEnd = day.set({hour: endHour, minute: endMinute, second: 0, millisecond: 0})
      const startIso = dayStart.toUTC().toISO()
      const endIso = dayEnd.toUTC().toISO()
      if (!startIso || !endIso) continue
      try {
        const slot = await this.createBlockedSlot({
          companyId: params.companyId,
          professionalId: params.professionalId,
          startTime: startIso,
          endTime: endIso
        })
        results.push(slot)
      } catch (err) {
        logger.warn({
          message: "Failed to create blocked slot for day in week",
          day: day.toFormat("yyyy-MM-dd"),
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
    return results
  }

  /**
   * Cria slots bloqueados para um dia da semana, nas próximas N semanas (ex.: toda segunda 12:00–13:00).
   * dayOfWeek: 0=domingo, 1=segunda, ..., 6=sábado.
   * startTime/endTime: "HH:mm" no fuso Brazil.
   */
  async createBlockedSlotsForDayOfWeek(params: {
    companyId: string
    professionalId: string
    dayOfWeek: number
    startTime: string
    endTime: string
    weeks?: number
  }): Promise<Slot[]> {
    const timezone = "America/Sao_Paulo"
    const weeks = params.weeks ?? 12
    const [startH, startM] = params.startTime.split(":").map(Number)
    const [endH, endM] = params.endTime.split(":").map(Number)
    const results: Slot[] = []
    const now = DateTime.now().setZone(timezone)
    const targetWeekday = params.dayOfWeek === 0 ? 7 : params.dayOfWeek
    let next = now.startOf("day").plus({days: (targetWeekday - now.weekday + 7) % 7})
    if (next < now.startOf("day")) next = next.plus({weeks: 1})
    for (let i = 0; i < weeks; i++) {
      const dayStart = next.set({hour: startH, minute: startM, second: 0, millisecond: 0})
      const dayEnd = next.set({hour: endH, minute: endM, second: 0, millisecond: 0})
      if (dayEnd <= now) {
        next = next.plus({weeks: 1})
        continue
      }
      const startIso = dayStart.toUTC().toISO()
      const endIso = dayEnd.toUTC().toISO()
      if (!startIso || !endIso) {
        next = next.plus({weeks: 1})
        continue
      }
      try {
        const slot = await this.createBlockedSlot({
          companyId: params.companyId,
          professionalId: params.professionalId,
          startTime: startIso,
          endTime: endIso
        })
        results.push(slot)
      } catch (err) {
        logger.warn({
          message: "Failed to create blocked slot for day of week",
          date: next.toFormat("yyyy-MM-dd"),
          error: err instanceof Error ? err.message : String(err)
        })
      }
      next = next.plus({weeks: 1})
    }
    return results
  }

  /**
   * Lista slots de um profissional no intervalo (para o painel - disponíveis e bloqueados).
   */
  async getSlotsForPanel(params: {
    companyId: string
    professionalId: string
    from: string
    to: string
  }): Promise<Slot[]> {
    const supabase = await createServiceClient()

    const {data: professional} = await supabase
      .from("professionals")
      .select("id")
      .eq("id", params.professionalId)
      .eq("company_id", params.companyId)
      .single()

    if (!professional) {
      throw new Error("Professional not found or doesn't belong to company")
    }

    const {data, error} = await supabase
      .from("slots")
      .select("*")
      .eq("professional_id", params.professionalId)
      .gte("start_time", params.from)
      .lte("start_time", params.to)
      .order("start_time", {ascending: true})

    if (error) {
      logger.error({
        message: "Failed to get slots for panel",
        error,
        professionalId: params.professionalId,
        companyId: params.companyId
      })
      throw new Error("Failed to get slots")
    }

    return data || []
  }

  /**
   * Remove um slot bloqueado (ou desbloqueia). Só remove se não houver booking no slot.
   */
  async deleteBlockedSlot(slotId: string, companyId: string): Promise<void> {
    const supabase = await createServiceClient()

    const {data: slot, error: slotError} = await supabase
      .from("slots")
      .select("id, professional_id, is_available")
      .eq("id", slotId)
      .single()

    if (slotError || !slot) {
      throw new Error("Slot not found")
    }

    const {data: professional} = await supabase
      .from("professionals")
      .select("id")
      .eq("id", slot.professional_id)
      .eq("company_id", companyId)
      .single()

    if (!professional) {
      throw new Error("Slot not found or doesn't belong to your company")
    }

    const {data: booking} = await supabase
      .from("bookings")
      .select("id")
      .eq("slot_id", slotId)
      .single()

    if (booking) {
      throw new Error("Cannot delete slot: it has an associated booking")
    }

    const {error: deleteError} = await supabase.from("slots").delete().eq("id", slotId)

    if (deleteError) {
      logger.error({
        message: "Failed to delete blocked slot",
        error: deleteError,
        slotId,
        companyId
      })
      throw new Error("Failed to delete slot")
    }
  }
}

export const slotService = new SlotService()
