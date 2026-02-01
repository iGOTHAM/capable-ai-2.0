import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId" },
      { status: 400 },
    );
  }

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const existingPayment = await db.payment.findFirst({
    where: { projectId, status: "COMPLETED" },
  });

  if (existingPayment) {
    return NextResponse.json(
      { error: "Project already paid for" },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    metadata: {
      projectId: project.id,
      userId: user.id,
    },
    success_url: `${appUrl}/projects/${project.id}?payment=success`,
    cancel_url: `${appUrl}/projects/${project.id}?payment=cancelled`,
  });

  // Create a pending payment record
  await db.payment.create({
    data: {
      userId: user.id,
      projectId: project.id,
      stripeCheckoutSessionId: session.id,
      amountCents: 0, // Will be updated by webhook
      status: "PENDING",
    },
  });

  return NextResponse.json({ url: session.url });
}
