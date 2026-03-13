"use client"

import {useEffect, useState, useRef} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {ConfirmModal} from "@/components/modals/ConfirmModal"
import {Trash2} from "lucide-react"

interface Professional {
  id: string
  name: string
}

interface Slot {
  id: string
  professional_id: string
  start_time: string
  end_time: string
  is_available: boolean
  service_id: string | null
}

const TIMEZONE_BRAZIL = "-03:00"

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado"
]

interface Availability {
  id: string
  professional_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

export function BlockedSlotsPageClient() {
  const fetchWithAuth = useApiFetch()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("")
  const [blockType, setBlockType] = useState<"specific_date" | "day_of_week">("specific_date")
  const [blockDate, setBlockDate] = useState("")
  const [blockDayOfWeek, setBlockDayOfWeek] = useState(1)
  const [blockStart, setBlockStart] = useState("09:00")
  const [blockEnd, setBlockEnd] = useState("10:00")
  const [blockWeeks, setBlockWeeks] = useState(12)
  const [recurrenceWeek, setRecurrenceWeek] = useState(false)
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingCreate, setLoadingCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState<Slot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchWithAuth("/api/v1/panel/professionals")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data?.length) {
          setProfessionals(data.data)
          if (!selectedProfessionalId && data.data[0]) {
            setSelectedProfessionalId(data.data[0].id)
          }
        }
      })
      .catch(() => setError("Erro ao carregar profissionais"))
  }, [])

  const loadSlots = async () => {
    if (!selectedProfessionalId) {
      setSlots([])
      return
    }
    setError(null)
    setLoadingSlots(true)
    try {
      const params = new URLSearchParams({professionalId: selectedProfessionalId})
      const response = await fetchWithAuth(`/api/v1/panel/slots?${params}`)
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao carregar horários")
        setSlots([])
        return
      }
      setSlots(data.data || [])
    } catch (err) {
      setError("Erro ao carregar horários")
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  useEffect(() => {
    if (selectedProfessionalId) loadSlots()
  }, [selectedProfessionalId])

  useEffect(() => {
    if (blockType !== "day_of_week" || !selectedProfessionalId) {
      setAvailabilities([])
      return
    }
    fetchWithAuth(`/api/v1/panel/availabilities?professionalId=${selectedProfessionalId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) setAvailabilities(data.data)
        else setAvailabilities([])
      })
      .catch(() => setAvailabilities([]))
  }, [blockType, selectedProfessionalId])

  const availabilityForDay = availabilities.find((a) => a.day_of_week === blockDayOfWeek)

  const handleCreateBlocked = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProfessionalId || !blockStart || !blockEnd) {
      setError("Preencha profissional e horários")
      return
    }
    if (blockType === "specific_date" && !blockDate) {
      setError("Selecione a data")
      return
    }
    setError(null)
    setLoadingCreate(true)
    try {
      if (blockType === "day_of_week") {
        const response = await fetchWithAuth("/api/v1/panel/slots", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            professionalId: selectedProfessionalId,
            blockType: "day_of_week",
            dayOfWeek: blockDayOfWeek,
            startTime: blockStart,
            endTime: blockEnd,
            weeks: blockWeeks
          })
        })
        const data = await response.json()
        if (!response.ok) {
          setError(data.error || "Erro ao bloquear horário")
          setLoadingCreate(false)
          return
        }
        setBlockStart("09:00")
        setBlockEnd("10:00")
        loadSlots()
      } else {
        const startTime = new Date(`${blockDate}T${blockStart}:00${TIMEZONE_BRAZIL}`).toISOString()
        const endTime = new Date(`${blockDate}T${blockEnd}:00${TIMEZONE_BRAZIL}`).toISOString()
        const response = await fetchWithAuth("/api/v1/panel/slots", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            professionalId: selectedProfessionalId,
            blockType: "specific_date",
            startTime,
            endTime,
            ...(recurrenceWeek ? {recurrence: "week"} : {})
          })
        })
        const data = await response.json()
        if (!response.ok) {
          setError(data.error || "Erro ao bloquear horário")
          setLoadingCreate(false)
          return
        }
        setBlockDate("")
        setBlockStart("09:00")
        setBlockEnd("10:00")
        setRecurrenceWeek(false)
        loadSlots()
      }
    } catch (err) {
      setError("Erro ao bloquear horário")
    } finally {
      setLoadingCreate(false)
    }
  }

  const handleDeleteSlot = async (slot: Slot) => {
    if (slot.service_id != null || slot.is_available) {
      setError("Só é possível remover horários bloqueados (sem agendamento).")
      return
    }
    setSlotToDelete(slot)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!slotToDelete) return
    setDeletingId(slotToDelete.id)
    try {
      const response = await fetchWithAuth(`/api/v1/panel/slots/${slotToDelete.id}`, {
        method: "DELETE"
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao remover")
        return
      }
      loadSlots()
      setConfirmOpen(false)
      setSlotToDelete(null)
    } catch (err) {
      setError("Erro ao remover horário")
    } finally {
      setDeletingId(null)
    }
  }

  const formatSlot = (s: Slot) => {
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    const day = start.toLocaleDateString("pt-BR", {weekday: "short", day: "2-digit", month: "2-digit"})
    const timeStart = start.toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})
    const timeEnd = end.toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})
    return `${day} ${timeStart}–${timeEnd}`
  }

  const blockedSlots = slots.filter((s) => !s.is_available && s.service_id == null)

  return (
    <div className="space-y-6" ref={listRef}>
      {error && <ErrorAlert message={error} />}

      <Card>
        <CardHeader>
          <CardTitle>Bloquear horário</CardTitle>
          <CardDescription>
            Escolha entre bloquear uma data específica no calendário ou um horário fixo em um dia da semana (com base
            no horário de trabalho do profissional).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateBlocked} className="space-y-4">
            <div className="flex flex-wrap gap-4 border-b pb-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input
                  type="radio"
                  name="blockType"
                  checked={blockType === "specific_date"}
                  onChange={() => setBlockType("specific_date")}
                  className="rounded-full border-input"
                />
                Data específica (calendário)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input
                  type="radio"
                  name="blockType"
                  checked={blockType === "day_of_week"}
                  onChange={() => setBlockType("day_of_week")}
                  className="rounded-full border-input"
                />
                Dia da semana (recorrente, ex.: toda segunda 12h–13h)
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Profissional</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm max-w-xs"
                value={selectedProfessionalId}
                onChange={(e) => setSelectedProfessionalId(e.target.value)}
                required
              >
                <option value="">Selecione</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {blockType === "specific_date" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data</label>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Das</label>
                  <input
                    type="time"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Até</label>
                  <input
                    type="time"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-4 flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={recurrenceWeek}
                      onChange={(e) => setRecurrenceWeek(e.target.checked)}
                      className="rounded border-input"
                    />
                    Repetir em todos os dias desta semana (mesmo horário em cada dia)
                  </label>
                </div>
              </div>
            )}

            {blockType === "day_of_week" && (
              <div className="space-y-4">
                {availabilityForDay && (
                  <p className="text-sm text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                    Horário de trabalho em {DAY_NAMES[blockDayOfWeek]}: {availabilityForDay.start_time} às{" "}
                    {availabilityForDay.end_time}
                  </p>
                )}
                {!availabilityForDay && selectedProfessionalId && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                    Nenhum horário de trabalho cadastrado para {DAY_NAMES[blockDayOfWeek]}. Cadastre em Profissionais →
                    Horários de trabalho.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dia da semana</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={blockDayOfWeek}
                      onChange={(e) => setBlockDayOfWeek(Number(e.target.value))}
                    >
                      {DAY_NAMES.map((name, i) => (
                        <option key={i} value={i}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Das</label>
                    <input
                      type="time"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Até</label>
                    <input
                      type="time"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Repetir nas próximas (semanas)</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={blockWeeks}
                      onChange={(e) => setBlockWeeks(Number(e.target.value))}
                    >
                      {[4, 8, 12, 24, 52].map((n) => (
                        <option key={n} value={n}>
                          {n} semanas
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loadingCreate} className="mt-2">
              {loadingCreate
                ? "Bloqueando..."
                : blockType === "day_of_week"
                  ? `Bloquear (${blockWeeks} ${blockWeeks === 1 ? "semana" : "semanas"})`
                  : recurrenceWeek
                    ? "Bloquear horário (7 dias)"
                    : "Bloquear horário"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horários bloqueados</CardTitle>
          <CardDescription>
            Lista de horários bloqueados (próximos 60 dias). Remova apenas os que não têm agendamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm font-medium">Profissional:</label>
            <select
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
            >
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {loadingSlots ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : blockedSlots.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum horário bloqueado. Bloqueie um horário acima.
            </p>
          ) : (
            <ul className="space-y-2">
              {blockedSlots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{formatSlot(s)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSlot(s)}
                    disabled={deletingId === s.id}
                    title="Remover bloqueio"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remover bloqueio"
        description="Deseja remover este horário bloqueado? Só é possível remover horários que não possuem agendamento."
        confirmText="Remover"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
