import {createServiceClient} from "@/lib/supabase/server"
import {logger} from "@/lib/logger"
import {activityLogService} from "./activity-log.service"

export interface CreateCompanyParams {
  name: string
  slug: string
  userId?: string
}

export class CompanyService {
  async createCompany(params: CreateCompanyParams) {
    const supabase = await createServiceClient()

    const {data, error} = await supabase
      .from("companies")
      .insert({
        name: params.name,
        slug: params.slug
      })
      .select()
      .single()

    if (error || !data) {
      logger.error({
        message: "Failed to create company",
        error,
        name: params.name,
        slug: params.slug
      })
      throw new Error("Failed to create company")
    }

    await activityLogService.log({
      userId: params.userId || null,
      action: "company_created",
      resourceType: "company",
      resourceId: data.id,
      metadata: {
        name: params.name,
        slug: params.slug
      }
    })

    logger.info({
      message: "Company created successfully",
      companyId: data.id,
      name: params.name
    })

    return data
  }

  async listCompanies() {
    const supabase = await createServiceClient()

    const {data, error} = await supabase.from("companies").select("*").order("created_at", {ascending: false})

    if (error) {
      logger.error({
        message: "Failed to list companies",
        error
      })
      throw new Error("Failed to list companies")
    }

    return data
  }

  async getCompanyById(id: string) {
    const supabase = await createServiceClient()

    const {data, error} = await supabase.from("companies").select("*").eq("id", id).single()

    if (error || !data) {
      logger.error({
        message: "Failed to get company",
        error,
        companyId: id
      })
      throw new Error("Company not found")
    }

    return data
  }

  async deleteCompany(id: string, userId?: string) {
    const supabase = await createServiceClient()

    const {error} = await supabase.from("companies").delete().eq("id", id)

    if (error) {
      logger.error({
        message: "Failed to delete company",
        error,
        companyId: id
      })
      throw new Error(error.code === "23503" ? "Não é possível excluir: existem registros vinculados (usuários, API keys, etc.)" : "Falha ao excluir empresa")
    }

    await activityLogService.log({
      userId: userId ?? null,
      action: "company_deleted",
      resourceType: "company",
      resourceId: id,
      metadata: {}
    })

    logger.info({
      message: "Company deleted successfully",
      companyId: id
    })

    return {deleted: true}
  }
}

export const companyService = new CompanyService()
