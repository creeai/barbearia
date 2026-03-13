"use client"

import {useState, useEffect, Suspense} from "react"
import Link from "next/link"
import {useRouter, useSearchParams} from "next/navigation"
import {createClient} from "@/lib/supabase/client"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const message = searchParams.get("message")
    if (message) {
      setSuccess(message)
    }

    // Verificar se há token de convite no hash da URL
    const hash = window.location.hash
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1))
      const type = hashParams.get("type")
      const accessToken = hashParams.get("access_token")

      if (type === "invite" && accessToken) {
        // Redirecionar para a página de aceitar convite com o token
        router.replace(`/auth/accept-invite${hash}`)
        return
      }
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const {data: signInData, error: signInError} = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (!signInData.user) {
        setError("Erro ao autenticar usuário")
        setLoading(false)
        return
      }

      // Aguardar um pouco para garantir que a sessão foi estabelecida
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Buscar role do usuário
      const {data: userData, error: userError} = await supabase
        .from("users")
        .select("role")
        .eq("auth_user_id", signInData.user.id)
        .single()

      if (userError || !userData) {
        console.error("Erro ao buscar role:", userError)
        // Mesmo assim, tentar redirecionar para a página inicial que fará o redirecionamento correto
        window.location.href = "/"
        return
      }

      // Redirecionar baseado no role
      if (userData.role === "super_admin") {
        window.location.href = "/super-admin/companies"
      } else if (userData.role === "admin") {
        window.location.href = "/admin/api-keys"
      } else {
        setError("Role não reconhecido")
        setLoading(false)
      }
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Entre com suas credenciais para acessar o painel</CardDescription>
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
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Carregando...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
