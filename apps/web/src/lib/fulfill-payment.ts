import { db } from "@/lib/db";
import { generatePackFiles } from "@/lib/pack-generator";
import { DEFAULT_CONFIG_PATCH } from "@capable-ai/shared";
import type { TemplateId } from "@capable-ai/shared";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

/**
 * Fulfills a completed payment: updates payment record, generates pack v1,
 * and creates deployment record. Idempotent — safe to call multiple times.
 */
export async function fulfillPayment(
  stripeCheckoutSessionId: string,
  opts: {
    paymentIntentId?: string | null;
    customerId?: string | null;
    amountCents?: number;
  },
) {
  const payment = await db.payment.findUnique({
    where: { stripeCheckoutSessionId },
  });

  if (!payment) return;
  if (payment.status === "COMPLETED") return; // already fulfilled

  // Update payment record
  await db.payment.update({
    where: { stripeCheckoutSessionId },
    data: {
      stripePaymentIntentId: opts.paymentIntentId ?? null,
      stripeCustomerId: opts.customerId ?? null,
      amountCents: opts.amountCents ?? 0,
      status: "COMPLETED",
    },
  });

  const projectId = payment.projectId;

  // Generate pack v1
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (project) {
    const existingPack = await db.packVersion.findFirst({
      where: { projectId, version: 1 },
    });

    if (!existingPack) {
      const files = generatePackFiles({
        templateId: project.templateId as TemplateId,
        mode: project.mode,
        description: project.description,
        neverRules: project.neverRules,
      });

      await db.packVersion.create({
        data: {
          projectId,
          version: 1,
          files,
          configPatch: DEFAULT_CONFIG_PATCH as unknown as Prisma.JsonObject,
          changelog: "Initial pack generation",
        },
      });
    }
  }

  // Create deployment record
  const existingDeployment = await db.deployment.findUnique({
    where: { projectId },
  });

  if (!existingDeployment) {
    await db.deployment.create({
      data: {
        projectId,
        projectToken: crypto.randomBytes(32).toString("hex"),
        status: "PENDING",
      },
    });
  }
}
