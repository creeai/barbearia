import {NextRequest, NextResponse} from "next/server"
import {requireAdminApi, ApiAuthError} from "@/lib/auth/api-helpers"
import {professionalService} from "@/lib/services/professional.service"
import {logger} from "@/lib/logger"
import {z} from "zod"
import type {ApiResponse} from "@/types/api"

const updateProfessionalSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable()
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
    const professional = await professionalService.getProfessionalById(id, user.companyId)
    return NextResponse.json({success: true, data: professional} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof Error && error.message === "Professional not found") {
      return NextResponse.json({success: false, error: "Profissional não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel GET professional", error})
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
    const validated = updateProfessionalSchema.parse(body)
    const professional = await professionalService.updateProfessional(id, user.companyId, validated)
    return NextResponse.json({success: true, data: professional} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {success: false, error: "Validation error", errors: error.flatten().fieldErrors} as ApiResponse,
        {status: 400}
      )
    }
    if (error instanceof Error && error.message === "Professional not found") {
      return NextResponse.json({success: false, error: "Profissional não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel PUT professional", error})
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
    await professionalService.deleteProfessional(id, user.companyId)
    return NextResponse.json({success: true, data: {message: "Profissional excluído"}} as ApiResponse)
  } catch (error) {
    if (error instanceof ApiAuthError) return error.toResponse()
    if (error instanceof Error && error.message === "Professional not found") {
      return NextResponse.json({success: false, error: "Profissional não encontrado"} as ApiResponse, {status: 404})
    }
    logger.error({message: "Panel DELETE professional", error})
    return NextResponse.json(
      {success: false, error: error instanceof Error ? error.message : "Erro interno"} as ApiResponse,
      {status: 500}
    )
  }
}
