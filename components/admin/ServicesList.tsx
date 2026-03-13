"use client"

import {useEffect, useState, forwardRef, useImperativeHandle} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Button} from "@/components/ui/button"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {ConfirmModal} from "@/components/modals/ConfirmModal"
import {Pencil, Trash2} from "lucide-react"
import {FormField} from "@/components/forms/FormField"

export interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number | null
  created_at: string
}

export interface ServicesListRef {
  refresh: () => void
}

export const ServicesList = forwardRef<ServicesListRef>((props, ref) => {
  const fetchWithAuth = useApiFetch()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
  const [editingService, setEditingService] = useState<Service | null>(null)

  const fetchServices = async () => {
    try {
      setLoading(true)
      const response = await fetchWithAuth("/api/v1/panel/services")
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao carregar serviços")
        return
      }
      setServices(data.data || [])
      setError(null)
    } catch (err) {
      setError("Erro ao carregar serviços")
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({refresh: fetchServices}))
  useEffect(() => {
    fetchServices()
  }, [])

  const handleDelete = async (s: Service) => {
    setDeletingId(s.id)
    try {
      const response = await fetchWithAuth(`/api/v1/panel/services/${s.id}`, {
        method: "DELETE"
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Erro ao excluir")
        return
      }
      fetchServices()
      setConfirmOpen(false)
      setServiceToDelete(null)
    } catch (err) {
      setError("Erro ao excluir serviço")
    } finally {
      setDeletingId(null)
    }
  }

  const openDeleteModal = (s: Service) => {
    setServiceToDelete(s)
    setConfirmOpen(true)
  }

  const formatPrice = (price: number | null) =>
    price != null ? new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"}).format(Number(price)) : "—"

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Serviços</CardTitle>
          <CardDescription>Lista de serviços da barbearia</CardDescription>
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
          <CardTitle>Serviços</CardTitle>
          <CardDescription>Lista de serviços da barbearia</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <ErrorAlert message={error} className="mb-4" />}
          {services.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum serviço cadastrado</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.duration_minutes} min</TableCell>
                      <TableCell>{formatPrice(s.price)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingService(s)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteModal(s)}
                            disabled={deletingId === s.id}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir serviço"
        description={`Excluir o serviço "${serviceToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={() => serviceToDelete && handleDelete(serviceToDelete)}
      />

      {editingService && (
        <EditServiceModal
          service={editingService}
          onClose={() => setEditingService(null)}
          onSaved={() => {
            setEditingService(null)
            fetchServices()
          }}
        />
      )}
    </>
  )
})

ServicesList.displayName = "ServicesList"

function EditServiceModal({
  service,
  onClose,
  onSaved
}: {
  service: Service
  onClose: () => void
  onSaved: () => void
}) {
  const fetchWithAuth = useApiFetch()
  const [name, setName] = useState(service.name)
  const [durationMinutes, setDurationMinutes] = useState(String(service.duration_minutes))
  const [price, setPrice] = useState(service.price != null ? String(service.price) : "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await fetchWithAuth(`/api/v1/panel/services/${service.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          name,
          durationMinutes: parseInt(durationMinutes, 10),
          price: price === "" ? null : parseFloat(price)
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
        <h3 className="text-lg font-semibold mb-4">Editar serviço</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          <FormField
            label="Nome"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <FormField
            label="Duração (minutos)"
            name="durationMinutes"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
          />
          <FormField
            label="Preço (R$)"
            name="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Opcional"
          />
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
