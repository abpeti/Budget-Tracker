import { useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const loginSchema = z.object({
  email: z.string().min(1, "Add meg az email címed.").email("Érvénytelen email cím."),
  password: z.string().min(1, "Add meg a jelszavad."),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { session, loading, signIn } = useAuth()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  if (!loading && session) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/"
    return <Navigate to={redirectTo} replace />
  }

  const onSubmit = async (values: LoginForm) => {
    setFormError(null)
    setSubmitting(true)
    const { error } = await signIn(values.email, values.password)
    setSubmitting(false)
    if (error) {
      setFormError(
        error === "Invalid login credentials"
          ? "Hibás email cím vagy jelszó."
          : error
      )
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Bejelentkezés</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Jelszó</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="mt-2">
              {submitting ? "Bejelentkezés…" : "Bejelentkezés"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
