"use client"

import {useEffect, useState, forwardRef, useImperativeHandle} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Button} from "@/components/ui/button"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {Pencil} from "lucide-react"
import {FormField} from "@/components/forms/FormField"

const TIMEZONE = "America/Sao_Paulo"

export interface Booking {
  id: string
  company_id: string
  professional_id: string
  service_id: string
  slot_id: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  status: string
  created_at: string
  slot_start_time?: string | null
  slot_end_time?: string | null
}

export interface BookingsListRef {
  refresh: () => void
}

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Concluído"
}

export const BookingsList = forwardRef<BookingsListRef>((props, ref) => {
  const fetchWithAuth = useApiFetch()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await fetchWithAuth("/api/v1/panel/bookings")
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao carregar agendamentos")
        return
      }
      setBookings(data.data || [])
      setError(null)
    } catch (err) {
      setError("Erro ao carregar agendamentos")
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({refresh: fetchBookings}))
  useEffect(() => {
    fetchBookings()
  }, [])

  /** Formata a data/hora do agendamento (slot) em pt-BR, timezone Brasil. Fallback para created_at se slot não vier. */
  const formatBookingDateTime = (b: Booking) => {
    const iso = b.slot_start_time || b.created_at
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos</CardTitle>
          <CardDescription>Lista de agendamentos da barbearia</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos</CardTitle>
          <CardDescription>Lista de agendamentos da barbearia</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <ErrorAlert message={error} className="mb-4" />}
          {bookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum agendamento</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.customer_name}</TableCell>
                      <TableCell>
                        {b.customer_email || b.customer_phone || "—"}
                      </TableCell>
                      <TableCell>{formatBookingDateTime(b)}</TableCell>
                      <TableCell>{statusLabel[b.status] ?? b.status}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingBooking(b)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSaved={() => {
            setEditingBooking(null)
            fetchBookings()
          }}
        />
      )}
    </>
  )
})

BookingsList.displayName = "BookingsList"

function EditBookingModal({
  booking,
  onClose,
  onSaved
}: {
  booking: Booking
  onClose: () => void
  onSaved: () => void
}) {
  const fetchWithAuth = useApiFetch()
  const [customerName, setCustomerName] = useState(booking.customer_name)
  const [customerEmail, setCustomerEmail] = useState(booking.customer_email || "")
  const [customerPhone, setCustomerPhone] = useState(booking.customer_phone || "")
  const [status, setStatus] = useState(booking.status)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await fetchWithAuth(`/api/v1/panel/bookings/${booking.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          customerName,
          customerEmail: customerEmail || null,
          customerPhone: customerPhone || null,
          status
        })
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao salvar")
        setLoading(false)
        return
      }
      onSaved()
    } catch (err) {
      setError("Erro ao salvar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Editar agendamento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="pending">Pendente</option>
              <option value="confirmed">Confirmado</option>
              <option value="cancelled">Cancelado</option>
              <option value="completed">Concluído</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
