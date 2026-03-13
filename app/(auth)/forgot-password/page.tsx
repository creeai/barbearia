"use client"

import {useState} from "react"
import Link from "next/link"
import {createClient} from "@/lib/supabase/client"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {ErrorAlert} from "@/components/layout/ErrorAlert"
import {LoadingSpinner} from "@/components/layout/LoadingSpinner"
import {ArrowLeft} from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : ""

      const {error: resetError} = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo
      })

      if (resetError) {
        const msg =
          resetError.message?.toLowerCase().includes("rate limit") ||
          resetError.message?.toLowerCase().includes("too many")
            ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
            : resetError.message
        setError(msg)
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError("Erro ao enviar email. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Email enviado</CardTitle>
            <CardDescription>
              Se existir uma conta com <strong>{email}</strong>, você receberá um link para redefinir sua senha.
              Verifique também a pasta de spam.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-800 dark:text-green-200">
              Enviamos as instruções para o seu email. O link expira em 1 hora.
            </div>
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
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            Informe seu email e enviaremos um link para redefinir sua senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorAlert message={error} />}

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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Enviando...
                </>
              ) : (
                "Enviar link de recuperação"
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
