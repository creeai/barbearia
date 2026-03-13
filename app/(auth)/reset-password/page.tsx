"use client"

import {useState, useEffect, Suspense} from "react"
import {useRouter, useSearchParams} from "next/navigation"
import Link from "next/link"
import {createClient} from "@/lib/supabase/client"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ArrowLeft} from "lucide-react"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const getHashTokens = () => {
      const hash = window.location.hash
      if (!hash) return null
      const hashParams = new URLSearchParams(hash.substring(1))
      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")
      const type = hashParams.get("type")
      if (type !== "recovery" || !accessToken) return null
      return {accessToken, refreshToken: refreshToken || ""}
    }

    const getQueryToken = () => {
      const type = searchParams.get("type")
      if (type !== "recovery") return null

      // Supabase pode enviar o token como "token_hash" ou "token"
      const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token")
      if (!tokenHash) return null

      return {tokenHash}
    }

    const run = async () => {
      try {
        const hashData = getHashTokens()
        if (hashData) {
          const {error: sessionError} = await supabase.auth.setSession({
            access_token: hashData.accessToken,
            refresh_token: hashData.refreshToken
          })
          if (sessionError) {
            setInvalidLink(true)
            setReady(true)
            return
          }
          window.history.replaceState(null, "", window.location.pathname)
          setReady(true)
          return
        }

        const queryData = getQueryToken()
        if (queryData) {
          const {data, error: verifyError} = await supabase.auth.verifyOtp({
            token_hash: queryData.tokenHash,
            type: "recovery"
          })
          if (verifyError || !data.session) {
            setInvalidLink(true)
            setReady(true)
            return
          }
          window.history.replaceState(null, "", window.location.pathname)
          setReady(true)
          return
        }

        setInvalidLink(true)
      } catch {
        setInvalidLink(true)
      } finally {
        setReady(true)
      }
    }

    run()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres")
      return
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const {error: updateError} = await supabase.auth.updateUser({password})

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      await supabase.auth.signOut()
      router.push("/login?message=Senha alterada com sucesso. Faça login com a nova senha.")
    } catch (err) {
      setError("Erro ao redefinir senha. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>Verificando link...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invalidLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link inválido ou expirado</CardTitle>
            <CardDescription>
              O link de redefinição de senha não é válido ou já expirou. Solicite um novo link na página de
              recuperação de senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ErrorAlert message="Use o link mais recente enviado ao seu email ou solicite um novo." />
            <Button asChild className="w-full">
              <Link href="/forgot-password">Solicitar novo link</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nova senha</CardTitle>
          <CardDescription>Digite e confirme sua nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorAlert message={error} />}

            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Salvando...
                </>
              ) : (
                "Redefinir senha"
              )}
            </Button>

            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Redefinir senha</CardTitle>
              <CardDescription>Carregando...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
