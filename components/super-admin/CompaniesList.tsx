"use client"

import {useEffect, useState, useImperativeHandle, forwardRef} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Button} from "@/components/ui/button"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {ConfirmModal} from "@/components/modals/ConfirmModal"
import {Trash2} from "lucide-react"

interface Company {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface CompaniesListRef {
  refresh: () => Promise<void>
}

export const CompaniesList = forwardRef<CompaniesListRef>((props, ref) => {
  const fetchWithAuth = useApiFetch()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null)

  const fetchCompanies = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithAuth("/api/v1/companies")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao carregar companies")
        return
      }

      setCompanies(data.data || [])
    } catch (err) {
      setError("Erro ao carregar companies")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  useImperativeHandle(ref, () => ({
    refresh: fetchCompanies
  }))

  const openDeleteModal = (company: Company) => {
    setCompanyToDelete(company)
    setConfirmModalOpen(true)
  }

  const handleDelete = async () => {
    if (!companyToDelete) return
    setDeletingId(companyToDelete.id)
    setError(null)
    try {
      const response = await fetchWithAuth(`/api/v1/companies/${companyToDelete.id}`, {
        method: "DELETE"
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao excluir empresa")
        return
      }

      setCompanyToDelete(null)
      setConfirmModalOpen(false)
      await fetchCompanies()
    } catch (err) {
      setError("Erro ao excluir empresa. Tente novamente.")
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>Lista de todas as companies</CardDescription>
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
        <CardTitle>Companies</CardTitle>
        <CardDescription>Lista de todas as companies</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorAlert message={error} />
        ) : companies.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Nenhuma company cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.slug}</TableCell>
                  <TableCell>{new Date(company.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => openDeleteModal(company)}
                      disabled={deletingId !== null}
                      title="Excluir empresa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>

    {companyToDelete && (
      <ConfirmModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        title="Excluir empresa?"
        description={`Tem certeza que deseja excluir "${companyToDelete.name}"? Esta ação não pode ser desfeita. Se houver usuários, API keys ou outros dados vinculados, a exclusão poderá falhar.`}
        confirmText={deletingId ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        onConfirm={handleDelete}
        variant="destructive"
      />
    )}
  </>
  )
})

CompaniesList.displayName = "CompaniesList"
