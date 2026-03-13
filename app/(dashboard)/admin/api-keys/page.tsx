import {redirect} from "next/navigation"

/**
 * API Keys são gerenciadas apenas pelo super admin.
 * Admin (barbearia) é redirecionado para o painel.
 */
export default function AdminApiKeysPage() {
  redirect("/admin/servicos")
}
