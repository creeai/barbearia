import {createServiceClient} from "@/lib/supabase/server"
import {logger} from "@/lib/logger"
import {activityLogService} from "./activity-log.service"
import type {UserRole} from "@/types/database"

export interface CreateUserParams {
  email: string
  name: string
  role: UserRole
  companyId: string | null
  createdBy?: string
}

export class UserService {
  async createUser(params: CreateUserParams) {
    const supabase = await createServiceClient()

    // Enviar convite por email (Supabase enviará link de confirmação)
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/accept-invite`

    const {data: authUser, error: authError} = await supabase.auth.admin.inviteUserByEmail(params.email, {
      data: {
        name: params.name
      },
      redirectTo
    })

    if (authError || !authUser.user) {
      logger.error({
        message: "Failed to invite user",
        error: authError,
        email: params.email
      })
      throw new Error(authError?.message || "Failed to invite user")
    }

    // Criar registro na tabela users
    const {data: user, error: userError} = await supabase
      .from("users")
      .insert({
        auth_user_id: authUser.user.id,
        company_id: params.companyId,
        role: params.role,
        name: params.name,
        email: params.email
      })
      .select()
      .single()

    if (userError || !user) {
      // Tentar remover o usuário do auth se falhar
      await supabase.auth.admin.deleteUser(authUser.user.id)

      logger.error({
        message: "Failed to create user record",
        error: userError,
        authUserId: authUser.user.id
      })
      throw new Error("Failed to create user record")
    }

    await activityLogService.log({
      companyId: params.companyId,
      userId: params.createdBy || null,
      action: "user_created",
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        email: params.email,
        role: params.role
      }
    })

    logger.info({
      message: "User created successfully",
      userId: user.id,
      email: params.email,
      role: params.role
    })

    return user
  }

  async listUsers(companyId?: string) {
    const supabase = await createServiceClient()

    let query = supabase.from("users").select("*").order("created_at", {ascending: false})

    if (companyId) {
      query = query.eq("company_id", companyId)
    }

    const {data, error} = await query

    if (error) {
      logger.error({
        message: "Failed to list users",
        error,
        companyId
      })
      throw new Error("Failed to list users")
    }

    return data
  }

  async getUserById(id: string) {
    const supabase = await createServiceClient()

    const {data, error} = await supabase.from("users").select("*").eq("id", id).single()

    if (error || !data) {
      logger.error({
        message: "Failed to get user",
        error,
        userId: id
      })
      throw new Error("User not found")
    }

    return data
  }

  /** Conta quantos usuários com role super_admin existem (não bloqueados). */
  async countSuperAdmins(excludeUserId?: string): Promise<number> {
    const supabase = await createServiceClient()
    let query = supabase
      .from("users")
      .select("id", {count: "exact", head: true})
      .eq("role", "super_admin")
    if (excludeUserId) {
      query = query.neq("id", excludeUserId)
    }
    const {count, error} = await query
    if (error) {
      logger.error({message: "Failed to count super admins", error})
      return 0
    }
    return count ?? 0
  }

  async deleteUser(id: string, deletedBy?: string) {
    const supabase = await createServiceClient()

    const user = await this.getUserById(id)
    const authUserId = user.auth_user_id
    const role = (user as {role?: string}).role

    if (role === "super_admin") {
      const otherSuperAdmins = await this.countSuperAdmins(id)
      if (otherSuperAdmins < 1) {
        throw new Error(
          "Não é possível excluir o último super admin. Crie outro super admin antes de excluir este."
        )
      }
    }

    const {error: deleteError} = await supabase.from("users").delete().eq("id", id)

    if (deleteError) {
      logger.error({
        message: "Failed to delete user record",
        error: deleteError,
        userId: id
      })
      throw new Error("Falha ao excluir usuário")
    }

    const {error: authError} = await supabase.auth.admin.deleteUser(authUserId)

    if (authError) {
      logger.warn({
        message: "User record deleted but failed to delete auth user",
        error: authError,
        authUserId
      })
    }

    await activityLogService.log({
      userId: deletedBy ?? null,
      action: "user_deleted",
      resourceType: "user",
      resourceId: id,
      metadata: {email: user.email}
    })

    logger.info({
      message: "User deleted successfully",
      userId: id,
      email: user.email
    })

    return {deleted: true}
  }

  async blockUser(id: string, blockedBy?: string) {
    const supabase = await createServiceClient()

    const user = await this.getUserById(id)

    if ((user as {is_blocked?: boolean}).is_blocked) {
      throw new Error("Usuário já está bloqueado")
    }

    const {error} = await supabase.from("users").update({is_blocked: true}).eq("id", id)

    if (error) {
      logger.error({
        message: "Failed to block user",
        error,
        userId: id
      })
      throw new Error("Falha ao bloquear usuário")
    }

    await activityLogService.log({
      userId: blockedBy ?? null,
      action: "user_blocked",
      resourceType: "user",
      resourceId: id,
      metadata: {email: user.email}
    })

    logger.info({
      message: "User blocked successfully",
      userId: id,
      email: user.email
    })

    return {blocked: true}
  }

  async unblockUser(id: string, unblockedBy?: string) {
    const supabase = await createServiceClient()

    const user = await this.getUserById(id)

    if (!(user as {is_blocked?: boolean}).is_blocked) {
      throw new Error("Usuário não está bloqueado")
    }

    const {error} = await supabase.from("users").update({is_blocked: false}).eq("id", id)

    if (error) {
      logger.error({
        message: "Failed to unblock user",
        error,
        userId: id
      })
      throw new Error("Falha ao desbloquear usuário")
    }

    await activityLogService.log({
      userId: unblockedBy ?? null,
      action: "user_unblocked",
      resourceType: "user",
      resourceId: id,
      metadata: {email: user.email}
    })

    logger.info({
      message: "User unblocked successfully",
      userId: id,
      email: user.email
    })

    return {unblocked: true}
  }
}

export const userService = new UserService()
