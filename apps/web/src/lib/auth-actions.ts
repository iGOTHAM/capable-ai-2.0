"use server";

import crypto from "crypto";
import { db } from "./db";
import { createSession, destroySession } from "./auth";
import { sendVerificationEmail } from "./email";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AuthResult = {
  error?: string;
  success?: boolean;
};

export async function register(
  _prevState: AuthResult | undefined,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // If they exist but haven't verified, resend the email
    if (!existing.emailVerified) {
      await sendEmailVerification(email);
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      email,
      passwordHash,
    },
  });

  await sendEmailVerification(email);
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

export async function login(
  _prevState: AuthResult | undefined,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return { error: "Invalid email or password" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  if (!user.emailVerified) {
    // Grandfather existing users created before email verification was added
    const verificationLaunchDate = new Date("2026-02-15T00:00:00Z");
    if (user.createdAt < verificationLaunchDate) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    } else {
      // Resend verification email and redirect
      await sendEmailVerification(email);
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  }

  await createSession(user.id);
  redirect("/projects");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * Send an email verification link.
 * Creates a VerificationToken and sends email via Resend.
 */
async function sendEmailVerification(email: string): Promise<void> {
  // Delete any existing verification tokens for this email
  await db.verificationToken.deleteMany({
    where: { identifier: email, type: "email_verification" },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.verificationToken.create({
    data: {
      identifier: email,
      token,
      type: "email_verification",
      expiresAt,
    },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  await sendVerificationEmail(email, verifyUrl);
}

/**
 * Resend verification email (called from verify-email page).
 */
export async function resendVerification(
  _prevState: AuthResult | undefined,
  formData: FormData,
): Promise<AuthResult> {
  const email = formData.get("email") as string;
  if (!email) return { error: "Email is required" };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    // Don't leak whether account exists
    return { success: true };
  }

  try {
    await sendEmailVerification(email);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return { error: "Failed to send email. Please try again." };
  }

  return { success: true };
}
