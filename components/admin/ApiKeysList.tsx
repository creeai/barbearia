"use client"

import {useEffect, useState, forwardRef, useImperativeHandle} from "react"
import {useRouter} from "next/navigation"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Button} from "@/components/ui/button"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {ConfirmModal} from "@/components/modals/ConfirmModal"
import {Trash2} from "lucide-react"

interface ApiKey {
  id: string
  apiClientId: string
  label: string
  maskedKey: string
  revoked: boolean
  createdAt: string
  revokedAt: string | null
  companyId?: string
}

export interface ApiKeysListRef {
  refresh: () => void
}

interface ApiKeysListProps {
  companies?: {id: string; name: string}[]
}

export const ApiKeysList = forwardRef<ApiKeysListRef, ApiKeysListProps>(({companies = []}, ref) => {
  const router = useRouter()
  const fetchWithAuth = useApiFetch()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null)

  const fetchKeys = async () => {
    try {
      setLoading(true)
      const response = await fetchWithAuth("/api/v1/api-keys")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao carregar API keys")
        return
      }

      setKeys(data.data || [])
      setError(null)
    } catch (err) {
      setError("Erro ao carregar API keys")
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({
    refresh: fetchKeys
  }))

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    try {
      const response = await fetchWithAuth(`/api/v1/api-keys/${id}/revoke`, {
        method: "PATCH"
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Erro ao revogar API key")
        return
      }

      router.refresh()
      fetchKeys()
    } catch (err) {
      setError("Erro ao revogar API key")
    } finally {
      setRevokingId(null)
      setKeyToRevoke(null)
    }
  }

  const openRevokeModal = (id: string) => {
    setKeyToRevoke(id)
    setConfirmModalOpen(true)
  }

  const showCompanyColumn = companies.length > 0
  const getCompanyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            {showCompanyColumn ? "Lista de todas as API keys das empresas" : "Lista de todas as suas API keys"}
          </CardDescription>
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
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            {showCompanyColumn ? "Lista de todas as API keys das empresas" : "Lista de todas as suas API keys"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <ErrorAlert message={error} className="mb-4" />}

          {keys.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma API key cadastrada</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showCompanyColumn && <TableHead>Empresa</TableHead>}
                    <TableHead>Label</TableHead>
                    <TableHead>Key (mascarada)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id}>
                      {showCompanyColumn && (
                        <TableCell className="font-medium">
                          {key.companyId ? getCompanyName(key.companyId) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{key.label}</TableCell>
                      <TableCell className="font-mono text-sm">{key.maskedKey}</TableCell>
                      <TableCell>
                        {key.revoked ? (
                          <span className="text-destructive">Revogada</span>
                        ) : (
                          <span className="text-green-600">Ativa</span>
                        )}
                      </TableCell>
                      <TableCell>{new Date(key.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        {!key.revoked && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openRevokeModal(key.id)}
                            disabled={revokingId === key.id}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {revokingId === key.id ? "Revogando..." : "Revogar"}
                          </Button>
                        )}
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
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        title="Revogar API Key"
        description="Deseja revogar esta API key? Esta ação não pode ser desfeita."
        confirmText="Revogar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (keyToRevoke) {
            handleRevoke(keyToRevoke)
          }
        }}
      />
    </>
  )
})

ApiKeysList.displayName = "ApiKeysList"
