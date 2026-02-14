import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getSubscription } from "@/lib/subscription-guard";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/superadmin";
import { SubscribeButton } from "@/components/subscribe-button";
import { ManageSubscriptionButton } from "@/components/manage-subscription-button";
import { UserManagementTable } from "@/components/superadmin/user-management-table";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const subscription = await getSubscription(user.id);
  const projectCount = await db.project.count({ where: { userId: user.id } });
  const hasBypass = (
    await db.user.findUnique({
      where: { id: user.id },
      select: { subscriptionBypass: true },
    })
  )?.subscriptionBypass === true;

  // Superadmin: fetch all users
  const isAdmin = isSuperAdmin(user.email);
  const allUsers = isAdmin
    ? await db.user.findMany({
        include: {
          subscription: true,
          _count: { select: { projects: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const userListData = allUsers.map((u) => ({
    id: u.id,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    subscriptionStatus: u.subscription?.status ?? null,
    projectCount: u._count.projects,
    subscriptionBypass: u.subscriptionBypass,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and subscription.
        </p>
      </div>

      {/* ── Subscription Card (hidden for bypass users) ── */}
      {!hasBypass && (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>
            Your plan and billing information.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {!subscription ? (
            // No subscription — show pricing
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">$9</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pay monthly, cancel anytime.
                  </p>
                  <ul className="mt-4 flex flex-col gap-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">&#10003;</span>
                      1 Capable Pack agent
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">&#10003;</span>
                      Custom subdomain
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">&#10003;</span>
                      Auto-HTTPS &amp; dashboard
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">&#10003;</span>
                      Pack updates
                    </li>
                  </ul>
                  <div className="mt-6">
                    <SubscribeButton plan="monthly" label="Subscribe — $9/mo" />
                  </div>
                </div>
                <div className="rounded-lg border border-primary p-6 ring-1 ring-primary">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">$80</span>
                    <span className="text-muted-foreground">/year</span>
                  </div>
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
                    Save 26% — $6.67/mo
                  </p>
                  <ul className="mt-4 flex flex-col gap-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">&#10003;</span>
                      Everything in monthly
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">&#10003;</span>
                      Save $28/year
                    </li>
                  </ul>
                  <div className="mt-6">
                    <SubscribeButton plan="yearly" label="Subscribe — $80/yr" />
                  </div>
                </div>
              </div>
            </div>
          ) : subscription.status === "CANCELED" ? (
            // Canceled subscription
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Canceled</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Your subscription has been canceled. Re-subscribe to regain
                access to your agent and subdomain hosting.
              </p>
              <SubscribeButton label="Re-subscribe" />
            </div>
          ) : (
            // Active or Trialing subscription
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    subscription.status === "TRIALING"
                      ? "secondary"
                      : subscription.status === "PAST_DUE"
                        ? "destructive"
                        : "default"
                  }
                >
                  {subscription.status === "TRIALING"
                    ? "Free Trial"
                    : subscription.status === "PAST_DUE"
                      ? "Past Due"
                      : "Active"}
                </Badge>
                {subscription.cancelAtPeriodEnd && (
                  <Badge variant="outline">Cancels at period end</Badge>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Plan</p>
                  <p className="text-sm text-muted-foreground">
                    Capable.ai Pro
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Usage</p>
                  <p className="text-sm text-muted-foreground">
                    {projectCount} / 1 agent
                  </p>
                </div>
                {subscription.status === "TRIALING" && subscription.trialEnd && (
                  <div>
                    <p className="text-sm font-medium">Trial ends</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.trialEnd.toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">
                    {subscription.cancelAtPeriodEnd
                      ? "Access until"
                      : "Next billing date"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.currentPeriodEnd.toLocaleDateString()}
                  </p>
                </div>
              </div>

              {subscription.status === "PAST_DUE" && (
                <p className="text-sm text-destructive">
                  Your payment failed. Please update your payment method to
                  avoid losing access.
                </p>
              )}

              <ManageSubscriptionButton />
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* ── Account Card ── */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium">Email</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Member since</p>
            <p className="text-sm text-muted-foreground">
              {user.createdAt.toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Super Admin Card (only for superadmin users) ── */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Super Admin</CardTitle>
            <CardDescription>
              Manage all users and their subscriptions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userListData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <UserManagementTable users={userListData} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
