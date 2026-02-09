"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  requestPasswordReset,
  type ResetResult,
} from "@/lib/password-reset-actions";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState<
    ResetResult | undefined,
    FormData
  >(requestPasswordReset, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.success ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              If an account exists with that email, we&apos;ve sent a password
              reset link. Check your inbox.
            </div>
            <Link
              href="/login"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              &larr; Back to sign in
            </Link>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            {state?.error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        )}
      </CardContent>
      {!state?.success && (
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
