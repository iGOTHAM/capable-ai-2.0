import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { generatePackFiles } from "@/lib/pack-generator";
import { DEFAULT_CONFIG_PATCH } from "@capable-ai/shared";
import type { TemplateId } from "@capable-ai/shared";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const projectId = session.metadata?.projectId;
    const userId = session.metadata?.userId;

    if (!projectId || !userId) {
      console.error("Missing metadata in checkout session:", session.id);
      return NextResponse.json({ received: true });
    }

    // Update payment record
    await db.payment.updateMany({
      where: { stripeCheckoutSessionId: session.id },
      data: {
        stripePaymentIntentId: session.payment_intent as string | null,
        stripeCustomerId: session.customer as string | null,
        amountCents: session.amount_total ?? 0,
        status: "COMPLETED",
      },
    });

    // Generate pack v1 with real content
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (project) {
      const existingPack = await db.packVersion.findFirst({
        where: { projectId, version: 1 },
      });

      const files = generatePackFiles({
        templateId: project.templateId as TemplateId,
        mode: project.mode,
        description: project.description,
        neverRules: project.neverRules,
      });

      if (!existingPack) {
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

    // Create deployment record with unique project token
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

  return NextResponse.json({ received: true });
}
