import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {serviceService} from "@/lib/services/service.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  durationMinutes: z.number().int().positive().optional(),
  price: z.number().positive().optional().nullable()
})

export async function GET(
  request: NextRequest,
  {params}: {params: {id: string}}
) {
  try {
    const user = await requireAdminApi(request)
    if (!user.companyId) {
      return NextResponse.json(
        {success: false, error: "Usuário não vinculado a uma barbearia"} as ApiResponse,
        {status: 400}
      )
    }
    const {id} = params
    const service = await serviceService.getServiceById(id, user.companyId)
    return NextResponse.json({success: true, data: service} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof Error && error.message === "Service not found") {
      return NextResponse.json({success: false, error: "Serviço não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel GET service", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}

export async function PUT(
  request: NextRequest,
  {params}: {params: {id: string}}
) {
  try {
    const user = await requireAdminApi(request)
    if (!user.companyId) {
      return NextResponse.json(
        {success: false, error: "Usuário não vinculado a uma barbearia"} as ApiResponse,
        {status: 400}
      )
    }
    const {id} = params
    const body = await request.json()
    const validated = updateServiceSchema.parse(body)
    const service = await serviceService.updateService(id, user.companyId, validated)
    return NextResponse.json({success: true, data: service} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {success: false, error: "Validation error", errors: error.flatten().fieldErrors} as ApiResponse,
        {status: 400}
      )
    }
    if (error instanceof Error && error.message === "Service not found") {
      return NextResponse.json({success: false, error: "Serviço não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel PUT service", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}

export async function DELETE(
  request: NextRequest,
  {params}: {params: {id: string}}
) {
  try {
    const user = await requireAdminApi(request)
    if (!user.companyId) {
      return NextResponse.json(
        {success: false, error: "Usuário não vinculado a uma barbearia"} as ApiResponse,
        {status: 400}
      )
    }
    const {id} = params
    await serviceService.deleteService(id, user.companyId)
    return NextResponse.json({success: true, data: {message: "Serviço excluído"}} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof Error && error.message === "Service not found") {
      return NextResponse.json({success: false, error: "Serviço não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel DELETE service", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
