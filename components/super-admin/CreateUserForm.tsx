"use client"

import {useState, useEffect} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"

interface Company {
  id: string
  name: string
}

interface CreateUserFormProps {
  onUserCreated?: () => void
}

export function CreateUserForm({onUserCreated}: CreateUserFormProps) {
  const fetchWithAuth = useApiFetch()
  const [companies, setCompanies] = useState<Company[]>([])
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"super_admin" | "admin">("admin")
  const [companyId, setCompanyId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      const response = await fetchWithAuth("/api/v1/companies")
      const data = await response.json()

      if (response.ok) {
        setCompanies(data.data || [])
      }
    } catch (err) {
      console.error("Error fetching companies:", err)
    } finally {
      setLoadingCompanies(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetchWithAuth("/api/v1/users", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          email,
          name,
          role,
          companyId: role === "admin" ? companyId : null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao criar usuário")
        setLoading(false)
        return
      }

      setEmail("")
      setName("")
      setCompanyId("")
      setSuccess(
        `Convite enviado com sucesso para ${data.data.email}. O usuário receberá um email com o link para definir sua senha.`
      )

      // Notificar o componente pai para atualizar a lista
      if (onUserCreated) {
        onUserCreated()
      }

      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError("Erro ao criar usuário. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar Usuário</CardTitle>
        <CardDescription>Adicione um novo usuário ao sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          {success && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-800 dark:text-green-200">
              {success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "super_admin" | "admin")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={loading}
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {role === "admin" && (
            <div className="space-y-2">
              <Label htmlFor="companyId">Company</Label>
              {loadingCompanies ? (
                <LoadingSpinner size="sm" />
              ) : (
                <select
                  id="companyId"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                  disabled={loading}
                >
                  <option value="">Selecione uma company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Criando...
              </>
            ) : (
              "Criar Usuário"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
