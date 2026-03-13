"use client"

import {useState} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {FormField} from "@/components/forms/FormField"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import type {CompaniesListRef} from "./CompaniesList"

interface CreateCompanyFormProps {
  onCompanyCreated?: () => void
}

export function CreateCompanyForm({onCompanyCreated}: CreateCompanyFormProps) {
  const fetchWithAuth = useApiFetch()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetchWithAuth("/api/v1/companies", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name, slug})
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao criar company")
        setLoading(false)
        return
      }

      setName("")
      setSlug("")

      // Notificar o componente pai para atualizar a lista
      if (onCompanyCreated) {
        onCompanyCreated()
      }
    } catch (err) {
      setError("Erro ao criar company. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar Company</CardTitle>
        <CardDescription>Adicione uma nova company ao sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}

          <FormField label="Nome" name="name" value={name} onChange={(e) => setName(e.target.value)} required />

          <FormField
            label="Slug"
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="exemplo-company"
            required
          />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Criando...
              </>
            ) : (
              "Criar Company"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
