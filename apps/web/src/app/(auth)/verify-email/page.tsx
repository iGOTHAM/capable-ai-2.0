"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { resendVerification, type AuthResult } from "@/lib/auth-actions";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const error = searchParams.get("error");

  const [state, formAction, isPending] = useActionState<
    AuthResult | undefined,
    FormData
  >(resendVerification, undefined);

  const errorMessages: Record<string, string> = {
    missing_token: "Missing verification token. Please check your email for the correct link.",
    invalid_token: "Invalid verification link. It may have already been used.",
    expired: "Your verification link has expired. Click below to get a new one.",
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        {error ? (
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
        ) : (
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
        )}
        <CardTitle>
          {error ? "Verification Failed" : "Check your email"}
        </CardTitle>
        <CardDescription>
          {error
            ? errorMessages[error] || "Something went wrong. Please try again."
            : email
              ? `We sent a verification link to ${email}`
              : "We sent a verification link to your email address"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          Click the link in the email to verify your account and get started.
          Check your spam folder if you don&apos;t see it.
        </p>

        {state?.success && (
          <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Verification email sent! Check your inbox.
          </div>
        )}

        {state?.error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        )}

        {email && (
          <form action={formAction}>
            <input type="hidden" name="email" value={email} />
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={isPending}
            >
              {isPending ? "Sending..." : "Resend verification email"}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Wrong email?{" "}
          <a
            href="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign up again
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
