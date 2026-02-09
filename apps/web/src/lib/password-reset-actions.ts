"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { sendPasswordResetEmail } from "./email";

export type ResetResult = {
  error?: string;
  success?: boolean;
};

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Request a password reset email.
 * Always returns success to avoid leaking whether an email exists.
 */
export async function requestPasswordReset(
  _prevState: ResetResult | undefined,
  formData: FormData,
): Promise<ResetResult> {
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { email } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });

  // Always return success even if user doesn't exist (prevent email enumeration)
  if (!user) {
    return { success: true };
  }

  // Delete any existing password reset tokens for this user
  await db.verificationToken.deleteMany({
    where: { identifier: email, type: "password_reset" },
  });

  // Generate secure token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.verificationToken.create({
    data: {
      identifier: email,
      token,
      type: "password_reset",
      expiresAt,
    },
  });

  // Send email
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    return { error: "Failed to send email. Please try again." };
  }

  return { success: true };
}

/**
 * Reset password using a valid token.
 */
export async function resetPassword(
  _prevState: ResetResult | undefined,
  formData: FormData,
): Promise<ResetResult> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { token, password } = parsed.data;

  // Find valid token
  const verificationToken = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken || verificationToken.type !== "password_reset") {
    return { error: "Invalid or expired reset link. Please request a new one." };
  }

  if (verificationToken.expiresAt < new Date()) {
    // Clean up expired token
    await db.verificationToken.delete({ where: { token } });
    return { error: "Reset link has expired. Please request a new one." };
  }

  const email = verificationToken.identifier;

  // Update password
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.update({
    where: { email },
    data: { passwordHash },
  });

  // Delete the used token
  await db.verificationToken.delete({ where: { token } });

  return { success: true };
}
