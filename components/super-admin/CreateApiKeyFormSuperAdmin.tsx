"use client"

import {useState, useEffect} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ApiKeyModal} from "@/components/modals/ApiKeyModal"

interface Company {
  id: string
  name: string
  slug: string
}

interface CreateApiKeyFormSuperAdminProps {
  onApiKeyCreated?: () => void
}

export function CreateApiKeyFormSuperAdmin({onApiKeyCreated}: CreateApiKeyFormSuperAdminProps) {
  const fetchWithAuth = useApiFetch()
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyId, setCompanyId] = useState("")
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<{key: string; label: string} | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchWithAuth("/api/v1/companies")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data?.length) {
          setCompanies(data.data)
          if (!companyId && data.data[0]) setCompanyId(data.data[0].id)
        }
      })
      .catch(() => setError("Erro ao carregar empresas"))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId || !label.trim()) {
      setError("Selecione a empresa e informe o label")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const response = await fetchWithAuth("/api/v1/api-keys", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({companyId, label: label.trim()})
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Erro ao criar API key")
        setLoading(false)
        return
      }
      setGeneratedKey({key: data.data.key, label: data.data.label})
      setModalOpen(true)
      setLabel("")
      onApiKeyCreated?.()
    } catch (err) {
      setError("Erro ao criar API key. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gerar API Key</CardTitle>
          <CardDescription>Crie uma nova chave de API para uma empresa (barbearia) cadastrada.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div className="space-y-2">
              <Label htmlFor="companyId">Empresa</Label>
              <select
                id="companyId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Selecione a empresa</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex: Produção, Desenvolvimento, etc."
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || companies.length === 0} className="w-full">
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Gerando...
                </>
              ) : (
                "Gerar API Key"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {generatedKey && (
        <ApiKeyModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          apiKey={generatedKey.key}
          label={generatedKey.label}
        />
      )}
    </>
  )
}
