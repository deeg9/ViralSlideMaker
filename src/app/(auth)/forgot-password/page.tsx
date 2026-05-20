import Link from 'next/link'
import Image from 'next/image'
import { requestPasswordReset } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ForgotPasswordPageProps {
  searchParams: Promise<{ error?: string; sent?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { error, sent } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="ViralSlideMaker" width={48} height={48} className="rounded-xl" />
          </div>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          {sent === '1' ? (
            <>
              <div className="mb-4 rounded-md bg-emerald-500/10 px-4 py-3 text-sm">
                If an account exists for that email, we just sent a reset link. Check your inbox.
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href="/login" className="underline underline-offset-4 hover:text-primary">
                  Back to sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <form action={requestPasswordReset} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Send reset link
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href="/login" className="underline underline-offset-4 hover:text-primary">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
