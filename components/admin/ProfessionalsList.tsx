"use client"

import {useEffect, useState, forwardRef, useImperativeHandle} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Button} from "@/components/ui/button"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {ConfirmModal} from "@/components/modals/ConfirmModal"
import {Pencil, Trash2, Clock} from "lucide-react"
import {FormField} from "@/components/forms/FormField"

export interface Professional {
  id: string
  name: string
  email: string | null
  phone: string | null
  created_at: string
}

export interface ProfessionalsListRef {
  refresh: () => void
}

export const ProfessionalsList = forwardRef<ProfessionalsListRef>((props, ref) => {
  const fetchWithAuth = useApiFetch()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [professionalToDelete, setProfessionalToDelete] = useState<Professional | null>(null)
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null)
  const [availabilitiesProfessional, setAvailabilitiesProfessional] = useState<Professional | null>(null)

  const fetchProfessionals = async () => {
    try {
      setLoading(true)
      const response = await fetchWithAuth("/api/v1/panel/professionals")
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao carregar profissionais")
        return
      }
      setProfessionals(data.data || [])
      setError(null)
    } catch (err) {
      setError("Erro ao carregar profissionais")
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({refresh: fetchProfessionals}))
  useEffect(() => {
    fetchProfessionals()
  }, [])

  const handleDelete = async (p: Professional) => {
    setDeletingId(p.id)
    try {
      const response = await fetchWithAuth(`/api/v1/panel/professionals/${p.id}`, {
        method: "DELETE"
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Erro ao excluir")
        return
      }
      fetchProfessionals()
      setConfirmOpen(false)
      setProfessionalToDelete(null)
    } catch (err) {
      setError("Erro ao excluir profissional")
    } finally {
      setDeletingId(null)
    }
  }

  const openDeleteModal = (p: Professional) => {
    setProfessionalToDelete(p)
    setConfirmOpen(true)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profissionais</CardTitle>
          <CardDescription>Barbeiros e profissionais da barbearia</CardDescription>
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
          <CardTitle>Profissionais</CardTitle>
          <CardDescription>Barbeiros e profissionais da barbearia</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <ErrorAlert message={error} className="mb-4" />}
          {professionals.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum profissional cadastrado</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="w-[180px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {professionals.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.email || "—"}</TableCell>
                      <TableCell>{p.phone || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAvailabilitiesProfessional(p)}
                            title="Horários de trabalho"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingProfessional(p)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteModal(p)}
                            disabled={deletingId === p.id}
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
        title="Excluir profissional"
        description={`Excluir "${professionalToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={() => professionalToDelete && handleDelete(professionalToDelete)}
      />

      {editingProfessional && (
        <EditProfessionalModal
          professional={editingProfessional}
          onClose={() => setEditingProfessional(null)}
          onSaved={() => {
            setEditingProfessional(null)
            fetchProfessionals()
          }}
        />
      )}

      {availabilitiesProfessional && (
        <AvailabilitiesModal
          professional={availabilitiesProfessional}
          onClose={() => setAvailabilitiesProfessional(null)}
        />
      )}
    </>
  )
})

ProfessionalsList.displayName = "ProfessionalsList"

function EditProfessionalModal({
  professional,
  onClose,
  onSaved
}: {
  professional: Professional
  onClose: () => void
  onSaved: () => void
}) {
  const fetchWithAuth = useApiFetch()
  const [name, setName] = useState(professional.name)
  const [email, setEmail] = useState(professional.email || "")
  const [phone, setPhone] = useState(professional.phone || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await fetchWithAuth(`/api/v1/panel/professionals/${professional.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          name,
          email: email === "" ? null : email,
          phone: phone === "" ? null : phone
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
        <h3 className="text-lg font-semibold mb-4">Editar profissional</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          <FormField label="Nome" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
          <FormField
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Opcional"
          />
          <FormField
            label="Telefone"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]

interface Availability {
  id: string
  professional_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

function AvailabilitiesModal({
  professional,
  onClose
}: {
  professional: Professional
  onClose: () => void
}) {
  const fetchWithAuth = useApiFetch()
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newDay, setNewDay] = useState(1)
  const [newStart, setNewStart] = useState("09:00")
  const [newEnd, setNewEnd] = useState("18:00")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAvailabilities = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth(
        `/api/v1/panel/availabilities?professionalId=${professional.id}`
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao carregar horários")
        setAvailabilities([])
        return
      }
      setAvailabilities(data.data || [])
    } catch (err) {
      setError("Erro ao carregar horários de trabalho")
      setAvailabilities([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailabilities()
  }, [professional.id])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetchWithAuth("/api/v1/panel/availabilities", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          professionalId: professional.id,
          dayOfWeek: newDay,
          startTime: newStart,
          endTime: newEnd
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao adicionar horário")
        setSaving(false)
        return
      }
      setNewStart("09:00")
      setNewEnd("18:00")
      fetchAvailabilities()
    } catch (err) {
      setError("Erro ao adicionar horário")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetchWithAuth(`/api/v1/panel/availabilities/${id}`, {
        method: "DELETE"
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Erro ao remover")
        return
      }
      fetchAvailabilities()
    } catch (err) {
      setError("Erro ao remover horário")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Horários de trabalho</h3>
        <p className="text-sm text-muted-foreground mb-4">{professional.name}</p>
        <p className="text-xs text-muted-foreground mb-4">
          Os horários abaixo definem em quais dias e em qual período este profissional atende. Eles são usados para
          gerar os horários disponíveis na tela de Agendamentos.
        </p>
        {error && <ErrorAlert message={error} className="mb-4" />}
        {loading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {availabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 mb-4">
                Nenhum horário cadastrado. Adicione abaixo os dias e horários em que este profissional atende.
              </p>
            ) : (
              <ul className="space-y-2 mb-4">
                {availabilities.map((av) => (
                  <li
                    key={av.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>
                      {DAY_NAMES[av.day_of_week]} — {av.start_time} às {av.end_time}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(av.id)}
                      disabled={deletingId === av.id}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAdd} className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Adicionar horário</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Dia</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    value={newDay}
                    onChange={(e) => setNewDay(Number(e.target.value))}
                  >
                    {DAY_NAMES.map((name, i) => (
                      <option key={i} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Das</label>
                  <input
                    type="time"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Até</label>
                  <input
                    type="time"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving} size="sm">
                {saving ? "Adicionando..." : "Adicionar horário"}
              </Button>
            </form>
          </>
        )}
        <div className="mt-4 pt-4 border-t flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
