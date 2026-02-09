"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Loader2 } from "lucide-react";
import { deleteUser, toggleSubscriptionBypass } from "@/lib/admin-actions";

interface UserRow {
  id: string;
  email: string;
  createdAt: string; // ISO string
  subscriptionStatus: string | null;
  projectCount: number;
  subscriptionBypass: boolean;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <Badge variant="secondary">None</Badge>;
  }

  switch (status) {
    case "ACTIVE":
      return <Badge variant="default">Active</Badge>;
    case "TRIALING":
      return <Badge variant="secondary">Trial</Badge>;
    case "PAST_DUE":
      return <Badge variant="destructive">Past Due</Badge>;
    case "CANCELED":
      return <Badge variant="outline">Canceled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function UserManagementTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(userId: string) {
    setDeletingUserId(userId);
    setError(null);

    const result = await deleteUser(userId);

    if (result.error) {
      setError(result.error);
      setDeletingUserId(null);
    } else {
      router.refresh();
      setDeletingUserId(null);
    }
  }

  async function handleToggleBypass(userId: string, enabled: boolean) {
    setTogglingUserId(userId);
    setError(null);

    const result = await toggleSubscriptionBypass(userId, enabled);

    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setTogglingUserId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead className="text-center">Bypass</TableHead>
              <TableHead className="text-center">Projects</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-sm">
                  {user.email}
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.subscriptionStatus} />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center">
                    <Switch
                      checked={user.subscriptionBypass}
                      onCheckedChange={(checked) =>
                        handleToggleBypass(user.id, checked)
                      }
                      disabled={togglingUserId !== null}
                      aria-label={`Toggle subscription bypass for ${user.email}`}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {user.projectCount}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={deletingUserId !== null}
                      >
                        {deletingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User Account?</AlertDialogTitle>
                        <AlertDialogDescription className="flex flex-col gap-2">
                          <span>
                            This will permanently delete{" "}
                            <span className="font-medium text-foreground">
                              {user.email}
                            </span>{" "}
                            and all associated data:
                          </span>
                          <span className="text-xs">
                            • All projects and pack files
                            <br />
                            • Active deployments (droplets will be destroyed)
                            <br />
                            • DNS records and subdomains
                            <br />
                            • Stripe subscription (will be canceled)
                          </span>
                          <span className="mt-1 font-medium text-destructive">
                            This action cannot be undone.
                          </span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(user.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete User
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {users.length} user{users.length !== 1 ? "s" : ""} total
      </p>
    </div>
  );
}
