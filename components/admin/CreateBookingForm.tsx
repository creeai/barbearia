"use client"

import {useEffect, useState} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {FormField} from "@/components/forms/FormField"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"

interface Professional {
  id: string
  name: string
}

interface Service {
  id: string
  name: string
  duration_minutes: number
}

interface SlotOption {
  start_time: string
  end_time: string
  label?: string
  slot_ids: string[]
}

const SLOTS_PER_PAGE = 6
const TIMEZONE = "America/Sao_Paulo"

function formatSlotLabelPtBr(slot: SlotOption): string {
  try {
    const start = new Date(slot.start_time)
    const end = new Date(slot.end_time)
    const startStr = start.toLocaleTimeString("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit"
    })
    const endStr = end.toLocaleTimeString("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit"
    })
    return `${startStr} às ${endStr}`
  } catch {
    return slot.label || `${slot.start_time} – ${slot.end_time}`
  }
}

function formatDatePtBr(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(`${dateStr}T12:00:00-03:00`)
  return d.toLocaleDateString("pt-BR", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long"
  })
}

interface CreateBookingFormProps {
  onBookingCreated?: () => void
}

export function CreateBookingForm({onBookingCreated}: CreateBookingFormProps) {
  const fetchWithAuth = useApiFetch()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [professionalId, setProfessionalId] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slotsPage, setSlotsPage] = useState(1)

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/v1/panel/professionals").then((r) => r.json()),
      fetchWithAuth("/api/v1/panel/services").then((r) => r.json())
    ]).then(([profData, servData]) => {
      if (profData.success && profData.data?.length) {
        setProfessionals(profData.data)
        if (!professionalId) setProfessionalId(profData.data[0].id)
      }
      if (servData.success && servData.data?.length) {
        setServices(servData.data)
        if (!serviceId) setServiceId(servData.data[0].id)
      }
    })
  }, [])

  // Busca horários disponíveis automaticamente quando profissional, serviço e data forem selecionados
  // Usa America/Sao_Paulo para from/to para que o dia selecionado seja o mesmo no servidor
  useEffect(() => {
    if (!professionalId || !serviceId || !selectedDate) {
      setSlots([])
      setSelectedSlotId("")
      return
    }
    const from = new Date(`${selectedDate}T00:00:00-03:00`).toISOString()
    const to = new Date(`${selectedDate}T23:59:59.999-03:00`).toISOString()
    let cancelled = false
    setError(null)
    setLoadingSlots(true)
    setSlots([])
    setSelectedSlotId("")
    setSlotsPage(1)
    const params = new URLSearchParams({
      professionalId,
      serviceId,
      from,
      to
    })
    fetchWithAuth(`/api/v1/panel/slots/available?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (!data.success) {
          setError(data.error || "Erro ao carregar horários")
          return
        }
        setSlots(data.data?.slots || [])
      })
      .catch(() => {
        if (!cancelled) setError("Erro ao carregar horários disponíveis")
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
  }, [professionalId, serviceId, selectedDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlotId || !customerName.trim()) {
      setError("Selecione um horário e informe o nome do cliente")
      return
    }
    setError(null)
    setLoadingSubmit(true)
    try {
      const response = await fetchWithAuth("/api/v1/panel/bookings", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          professionalId,
          serviceId,
          slotId: selectedSlotId,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || null,
          customerPhone: customerPhone.trim() || null
        })
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao criar agendamento")
        setLoadingSubmit(false)
        return
      }
      setCustomerName("")
      setCustomerEmail("")
      setCustomerPhone("")
      setSelectedSlotId("")
      setSlots([])
      onBookingCreated?.()
    } catch (err) {
      setError("Erro ao criar agendamento")
    } finally {
      setLoadingSubmit(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo agendamento</CardTitle>
        <CardDescription>Crie um agendamento para um cliente</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Profissional</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={professionalId}
                onChange={(e) => {
                  setProfessionalId(e.target.value)
                  setSlots([])
                  setSelectedSlotId("")
                  setSlotsPage(1)
                }}
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Serviço</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value)
                  setSlots([])
                  setSelectedSlotId("")
                  setSlotsPage(1)
                }}
                required
              >
                <option value="">Selecione</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} min)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Data desejada</label>
            <input
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          {professionalId && serviceId && selectedDate && (
            <>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoadingSpinner size="sm" />
                  Carregando horários disponíveis para o dia {formatDatePtBr(selectedDate)}...
                </div>
              ) : slots.length > 0 ? (
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Horários disponíveis para {formatDatePtBr(selectedDate)}
                  </label>
                  {(() => {
                    const totalPages = Math.ceil(slots.length / SLOTS_PER_PAGE)
                    const start = (slotsPage - 1) * SLOTS_PER_PAGE
                    const paginatedSlots = slots.slice(start, start + SLOTS_PER_PAGE)
                    return (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {paginatedSlots.map((slot) => {
                            const id = slot.slot_ids?.[0]
                            if (!id) return null
                            return (
                              <Button
                                key={id}
                                type="button"
                                variant={selectedSlotId === id ? "default" : "outline"}
                                className="justify-start"
                                onClick={() => setSelectedSlotId(id)}
                              >
                                {formatSlotLabelPtBr(slot)}
                              </Button>
                            )
                          })}
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t text-sm">
                            <span className="text-muted-foreground">
                              Página {slotsPage} de {totalPages} ({slots.length} horários)
                            </span>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSlotsPage((p) => Math.max(1, p - 1))}
                                disabled={slotsPage <= 1}
                              >
                                Anterior
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSlotsPage((p) => Math.min(totalPages, p + 1))}
                                disabled={slotsPage >= totalPages}
                              >
                                Próxima
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Nenhum horário disponível para o dia {formatDatePtBr(selectedDate)}.
                  </p>
                  <p className="mt-2 text-amber-700 dark:text-amber-300">
                    Para que os horários apareçam, cadastre os <strong>dias e horários de atendimento</strong> deste
                    profissional em <strong>Profissionais</strong>: clique no ícone de relógio ao lado do nome do
                    profissional e adicione os horários em que ele atende (ex.: Segunda-feira 09:00 às 18:00).
                  </p>
                </div>
              )}
            </>
          )}
          <FormField
            label="Nome do cliente"
            name="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
          <FormField
            label="Email"
            name="customerEmail"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="Opcional"
          />
          <FormField
            label="Telefone"
            name="customerPhone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Opcional"
          />
          <Button type="submit" disabled={loadingSubmit || !selectedSlotId} className="w-full">
            {loadingSubmit ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Criando...
              </>
            ) : (
              "Criar agendamento"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
