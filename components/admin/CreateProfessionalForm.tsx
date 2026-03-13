"use client"

import {useState} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {FormField} from "@/components/forms/FormField"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"

interface CreateProfessionalFormProps {
  onProfessionalCreated?: () => void
}

export function CreateProfessionalForm({onProfessionalCreated}: CreateProfessionalFormProps) {
  const fetchWithAuth = useApiFetch()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await fetchWithAuth("/api/v1/panel/professionals", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          name,
          email: email === "" ? null : email,
          phone: phone === "" ? null : phone
        })
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao criar profissional")
        setLoading(false)
        return
      }
      setName("")
      setEmail("")
      setPhone("")
      onProfessionalCreated?.()
    } catch (err) {
      setError("Erro ao criar profissional. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo profissional</CardTitle>
        <CardDescription>Cadastre um barbeiro ou profissional</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          <FormField
            label="Nome"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João Silva"
            required
          />
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
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Cadastrando...
              </>
            ) : (
              "Cadastrar profissional"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
