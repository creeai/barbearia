"use client"

import {useEffect, useState, useImperativeHandle, forwardRef} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Button} from "@/components/ui/button"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {ConfirmModal} from "@/components/modals/ConfirmModal"
import {Trash2, Ban, LockOpen} from "lucide-react"

interface User {
  id: string
  email: string
  name: string
  role: string
  companyId: string | null
  createdAt: string
  isBlocked?: boolean
}

export interface UsersListRef {
  refresh: () => Promise<void>
}

interface UsersListProps {
  currentUserId?: string
}

export const UsersList = forwardRef<UsersListRef, UsersListProps>(({currentUserId}, ref) => {
  const fetchWithAuth = useApiFetch()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    type: "delete" | "block" | "unblock"
    user: User | null
  }>({open: false, type: "delete", user: null})

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithAuth("/api/v1/users")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao carregar usuários")
        return
      }

      setUsers(data.data || [])
    } catch (err) {
      setError("Erro ao carregar usuários")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useImperativeHandle(ref, () => ({
    refresh: fetchUsers
  }))

  const openModal = (type: "delete" | "block" | "unblock", user: User) => {
    setConfirmModal({open: true, type, user})
  }

  const closeModal = () => {
    setConfirmModal((prev) => ({...prev, open: false, user: null}))
    setActionId(null)
  }

  const runAction = async () => {
    const {type, user} = confirmModal
    if (!user) return
    setActionId(user.id)
    setError(null)
    try {
      const urls: Record<typeof type, string> = {
        delete: `/api/v1/users/${user.id}`,
        block: `/api/v1/users/${user.id}/block`,
        unblock: `/api/v1/users/${user.id}/unblock`
      }
      const method = type === "delete" ? "DELETE" : "PATCH"
      const response = await fetchWithAuth(urls[type], {method})
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || (type === "delete" ? "Erro ao excluir usuário" : type === "block" ? "Erro ao bloquear usuário" : "Erro ao desbloquear usuário"))
        return
      }

      closeModal()
      await fetchUsers()
    } catch (err) {
      setError("Erro ao executar ação. Tente novamente.")
    } finally {
      setActionId(null)
    }
  }

  const isCurrentUser = (id: string) => currentUserId != null && id === currentUserId

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Lista de todos os usuários</CardDescription>
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
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Lista de todos os usuários. Bloquear impede login; excluir remove o usuário.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorAlert message={error} />
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum usuário cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
                      <span className={user.isBlocked ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {user.isBlocked ? "Bloqueado" : "Ativo"}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {user.isBlocked ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-600 hover:text-green-700 hover:bg-green-500/10"
                            onClick={() => openModal("unblock", user)}
                            disabled={actionId !== null}
                            title="Desbloquear"
                          >
                            <LockOpen className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            onClick={() => openModal("block", user)}
                            disabled={actionId !== null || isCurrentUser(user.id)}
                            title={isCurrentUser(user.id) ? "Não é possível bloquear a si mesmo" : "Bloquear"}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openModal("delete", user)}
                          disabled={actionId !== null || isCurrentUser(user.id)}
                          title={isCurrentUser(user.id) ? "Não é possível excluir a si mesmo" : "Excluir"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {confirmModal.user && (
        <ConfirmModal
          open={confirmModal.open}
          onOpenChange={(open) => !open && closeModal()}
          title={
            confirmModal.type === "delete"
              ? "Excluir usuário?"
              : confirmModal.type === "block"
                ? "Bloquear usuário?"
                : "Desbloquear usuário?"
          }
          description={
            confirmModal.type === "delete"
              ? `Tem certeza que deseja excluir "${confirmModal.user.name}" (${confirmModal.user.email})? O usuário será removido e não poderá mais acessar o sistema.`
              : confirmModal.type === "block"
                ? `Tem certeza que deseja bloquear "${confirmModal.user.name}"? O usuário não poderá fazer login até ser desbloqueado.`
                : `Desbloquear "${confirmModal.user.name}"? O usuário poderá fazer login novamente.`
          }
          confirmText={
            actionId ? "Aguarde..." : confirmModal.type === "delete" ? "Excluir" : confirmModal.type === "block" ? "Bloquear" : "Desbloquear"
          }
          cancelText="Cancelar"
          onConfirm={runAction}
          variant={confirmModal.type === "delete" || confirmModal.type === "block" ? "destructive" : "default"}
        />
      )}
    </>
  )
})

UsersList.displayName = "UsersList"
