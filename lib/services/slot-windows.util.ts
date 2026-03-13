import { DateTime } from 'luxon'

export interface BaseSlot {
  id: string
  professional_id: string
  start_time: string // ISO
  end_time: string // ISO
  is_available: boolean
}

export interface Window {
  start_time: string
  end_time: string
  slot_ids: string[]
}

export interface BuildParams {
  baseSlots: BaseSlot[]
  durationMinutes: number
  slotStepMinutes: number
  now: string // ISO
  closingTime: string // HH:mm
  timezone: string
  minLeadMinutes?: number
}

export function buildServiceWindowsFromBaseSlots({ baseSlots, durationMinutes, slotStepMinutes, now, closingTime, timezone, minLeadMinutes }: BuildParams): Window[] {
  // Sort baseSlots by start_time asc
  const slots = [...baseSlots].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  const needed = Math.ceil(durationMinutes / slotStepMinutes)
  const windows: Window[] = []

  const nowDt = DateTime.fromISO(now, { zone: timezone })
  const minLead = (minLeadMinutes && Number.isFinite(minLeadMinutes)) ? minLeadMinutes : 0

  // Log para debug
  if (slots.length === 0) {
    console.log('[buildServiceWindowsFromBaseSlots] No base slots provided', {
      durationMinutes,
      slotStepMinutes,
      needed,
      now,
      closingTime,
      timezone
    })
    return []
  }

  // closingTime is HH:mm local time — build DateTime for each slot's day
  let debugInfo: any[] = []
  
  for (let i = 0; i <= slots.length - needed; i++) {
    // check consecutive needed slots starting at i
    const group = slots.slice(i, i + needed)
    const debugEntry: any = {
      groupIndex: i,
      groupSize: group.length,
      needed,
      slots: group.map(s => ({
        id: s.id,
        start_time: s.start_time,
        is_available: s.is_available
      }))
    }

    // all must be available
    if (group.some(s => !s.is_available)) {
      debugEntry.rejected = "Some slots not available"
      debugInfo.push(debugEntry)
      continue
    }

    // check consecutive timing: each slot starts slotStepMinutes after previous
    // Parse slots from UTC and convert to timezone
    let consecutive = true
    let consecutiveDetails: any[] = []
    for (let j = 1; j < group.length; j++) {
      const prevStart = DateTime.fromISO(group[j-1].start_time, { zone: 'utc' }).setZone(timezone)
      const currStart = DateTime.fromISO(group[j].start_time, { zone: 'utc' }).setZone(timezone)
      const diffMinutes = currStart.diff(prevStart, 'minutes').minutes
      consecutiveDetails.push({
        prev: prevStart.toFormat('yyyy-MM-dd HH:mm'),
        curr: currStart.toFormat('yyyy-MM-dd HH:mm'),
        diffMinutes,
        expected: slotStepMinutes
      })
      if (diffMinutes !== slotStepMinutes) {
        consecutive = false
        break
      }
    }
    debugEntry.consecutiveCheck = {
      isConsecutive: consecutive,
      details: consecutiveDetails
    }
    
    if (!consecutive) {
      debugEntry.rejected = "Slots not consecutive"
      debugInfo.push(debugEntry)
      continue
    }

    const windowStart = DateTime.fromISO(group[0].start_time, { zone: 'utc' }).setZone(timezone)
    const windowEnd = windowStart.plus({ minutes: durationMinutes })

    // lead time: start must be >= now + minLead
    // Se for no mesmo dia, arredondar para o próximo múltiplo de slotStep
    const nowWithLead = nowDt.plus({ minutes: minLead })
    
    debugEntry.timeChecks = {
      windowStart: windowStart.toFormat('yyyy-MM-dd HH:mm'),
      windowEnd: windowEnd.toFormat('yyyy-MM-dd HH:mm'),
      now: nowDt.toFormat('yyyy-MM-dd HH:mm'),
      nowWithLead: nowWithLead.toFormat('yyyy-MM-dd HH:mm'),
      sameDay: windowStart.hasSame(nowWithLead, 'day')
    }
    
    // Se a janela for em um dia futuro, permitir
    // Se for no mesmo dia, verificar se está no futuro com arredondamento
    if (windowStart.hasSame(nowWithLead, 'day')) {
      // Mesmo dia: arredondar para o próximo múltiplo de slotStep
      const minutesSinceMidnight = (dt: DateTime) => dt.hour * 60 + dt.minute
      const nowTotalMins = minutesSinceMidnight(nowWithLead)
      const rounded = Math.ceil(nowTotalMins / slotStepMinutes) * slotStepMinutes
      const roundedDt = nowWithLead.startOf('day').plus({ minutes: rounded })
      debugEntry.timeChecks.roundedDt = roundedDt.toFormat('yyyy-MM-dd HH:mm')
      debugEntry.timeChecks.passedTimeCheck = windowStart >= roundedDt
      if (windowStart < roundedDt) {
        debugEntry.rejected = "Window start before rounded time"
        debugInfo.push(debugEntry)
        continue
      }
    } else if (windowStart < nowWithLead) {
      // Dia diferente mas no passado: rejeitar
      debugEntry.rejected = "Window in the past"
      debugInfo.push(debugEntry)
      continue
    } else {
      debugEntry.timeChecks.passedTimeCheck = true
    }

    // check windowEnd <= closingTime for that day
    const [ch, cm] = closingTime.split(':').map(Number)
    const closeDt = windowStart.set({ hour: ch, minute: cm, second: 0, millisecond: 0 })
    debugEntry.timeChecks.closingTime = closeDt.toFormat('yyyy-MM-dd HH:mm')
    debugEntry.timeChecks.passedClosingCheck = windowEnd <= closeDt
    
    if (windowEnd > closeDt) {
      debugEntry.rejected = "Window end after closing time"
      debugInfo.push(debugEntry)
      continue
    }

    // Passed all checks — collect slot ids
    debugEntry.accepted = true
    debugInfo.push(debugEntry)
    
    const startIso = windowStart.toUTC().toISO()
    const endIso = windowEnd.toUTC().toISO()
    if (!startIso || !endIso) {
      debugEntry.rejected = "Failed to serialize window ISO"
      continue
    }

    windows.push({
      start_time: startIso,
      end_time: endIso,
      slot_ids: group.map(s => s.id)
    })
  }

  // Log debug info
  console.log('[buildServiceWindowsFromBaseSlots] Debug info:', JSON.stringify({
    totalSlots: slots.length,
    needed,
    windowsCreated: windows.length,
    debugInfo: debugInfo.slice(0, 10) // Limitar a 10 primeiros para não poluir
  }, null, 2))

  return windows
}
