"use client"

import {useState} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {FormField} from "@/components/forms/FormField"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"

interface CreateServiceFormProps {
  onServiceCreated?: () => void
}

export function CreateServiceForm({onServiceCreated}: CreateServiceFormProps) {
  const fetchWithAuth = useApiFetch()
  const [name, setName] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("30")
  const [price, setPrice] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await fetchWithAuth("/api/v1/panel/services", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          name,
          durationMinutes: parseInt(durationMinutes, 10),
          price: price === "" ? null : parseFloat(price)
        })
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao criar serviço")
        setLoading(false)
        return
      }
      setName("")
      setDurationMinutes("30")
      setPrice("")
      onServiceCreated?.()
    } catch (err) {
      setError("Erro ao criar serviço. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo serviço</CardTitle>
        <CardDescription>Cadastre um serviço oferecido pela barbearia</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          <FormField
            label="Nome"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Corte de cabelo"
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
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Cadastrando...
              </>
            ) : (
              "Cadastrar serviço"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
