import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

export async function sendDeploymentReadyEmail(
  to: string,
  agentName: string,
  dashboardUrl: string,
): Promise<void> {
  const resend = getResend();

  await resend.emails.send({
    from: "Capable.ai <noreply@capable.ai>",
    to,
    subject: `Your agent "${agentName}" is live!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Your agent is live! 🎉</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">
          <strong>${agentName}</strong> has been deployed and is ready to use.
        </p>
        <p style="color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          Your private dashboard is available at:
        </p>
        <a href="${dashboardUrl}"
           style="display: inline-block; background: #18181b; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Open Dashboard
        </a>
        <p style="color: #555; font-size: 13px; line-height: 1.6; margin-top: 24px;">
          You can also manage your deployment from your
          <a href="https://capable.ai/projects" style="color: #18181b; font-weight: 500;">Capable.ai account</a>.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
        <p style="color: #999; font-size: 11px;">Capable.ai — Your server, your data.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<void> {
  const resend = getResend();

  await resend.emails.send({
    from: "Capable.ai <noreply@capable.ai>",
    to,
    subject: "Verify your email address",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Verify your email</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          Thanks for signing up for Capable.ai! Click the button below to verify your email address and get started.
        </p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #18181b; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Verify Email
        </a>
        <p style="color: #999; font-size: 12px; line-height: 1.5; margin-top: 32px;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
        <p style="color: #999; font-size: 11px;">Capable.ai — Your server, your data.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const resend = getResend();

  await resend.emails.send({
    from: "Capable.ai <noreply@capable.ai>",
    to,
    subject: "Reset your password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Reset your password</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset the password for your Capable.ai account.
          Click the button below to choose a new password.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #18181b; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Reset Password
        </a>
        <p style="color: #999; font-size: 12px; line-height: 1.5; margin-top: 32px;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
        <p style="color: #999; font-size: 11px;">Capable.ai — Your server, your data.</p>
      </div>
    `,
  });
}
