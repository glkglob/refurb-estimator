"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch, isApiFetchError } from "@/lib/apiClient";
import type { Profile, UserRole } from "@/lib/platform-types";

type AdminUsersResponse = {
  data: Profile[];
  total: number;
  page: number;
  limit: number;
  stats: {
    totalUsers: number;
    tradespeople: number;
    verifiedTradespeople: number;
    customers: number;
  };
};

function roleBadgeClass(role: UserRole): string {
  if (role === "admin") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  }
  if (role === "tradesperson") {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  return "border-border bg-secondary/40 text-muted-foreground";
}

export default function AdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [stats, setStats] = useState<AdminUsersResponse["stats"]>({
    totalUsers: 0,
    tradespeople: 0,
    verifiedTradespeople: 0,
    customers: 0
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [emailQuery, setEmailQuery] = useState("");
  const [debouncedEmailQuery, setDebouncedEmailQuery] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedEmailQuery(emailQuery.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [emailQuery]);

  useEffect(() => {
    let isActive = true;

    async function fetchCurrentUser() {
      try {
        const response = await apiFetch("/api/v1/profile");
        const profile = (await response.json()) as Profile;
        if (profile.role !== "admin") {
          router.replace("/");
          return;
        }

        if (isActive) {
          setCurrentUser(profile);
        }
      } catch (fetchError) {
        if (isApiFetchError(fetchError) && fetchError.status === 401) {
          router.replace("/auth/login");
          return;
        }
        if (isActive) {
          setError(
            fetchError instanceof Error ? fetchError.message : "Unable to load admin profile."
          );
        }
      }
    }

    void fetchCurrentUser();

    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin") {
      return;
    }

    let isActive = true;

    async function fetchUsers() {
      setIsLoading(true);
      setError(null);

      try {
        const search = new URLSearchParams({
          page: String(page),
          limit: String(limit)
        });

        if (roleFilter !== "all") {
          search.set("role", roleFilter);
        }

        if (debouncedEmailQuery) {
          search.set("email", debouncedEmailQuery);
        }

        const response = await apiFetch(`/api/v1/admin/users?${search.toString()}`);

        if (!isActive) {
          return;
        }

        const parsed = (await response.json()) as AdminUsersResponse;
        setUsers(parsed.data ?? []);
        setTotal(parsed.total ?? 0);
        setStats(parsed.stats);
      } catch (fetchError) {
        if (
          isApiFetchError(fetchError) &&
          (fetchError.status === 401 || fetchError.status === 403)
        ) {
          router.replace("/");
          return;
        }
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load users.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void fetchUsers();

    return () => {
      isActive = false;
    };
  }, [currentUser, debouncedEmailQuery, limit, page, roleFilter, router]);

  async function updateUser(userId: string, updates: { role?: UserRole; isVerified?: boolean }) {
    setIsUpdating(userId);
    setError(null);

    try {
      const response = await apiFetch("/api/v1/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, ...updates })
      });
      await response.json().catch(() => null);

      setUsers((prev) =>
        prev.map((user) => {
          if (user.id !== userId) {
            return user;
          }
          return {
            ...user,
            role: updates.role ?? user.role,
            isVerified: updates.isVerified ?? user.isVerified
          };
        })
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update user.");
    } finally {
      setIsUpdating(null);
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [limit, total]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage users, roles, and verification status across the platform.
        </p>
      </header>

      {error ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total users</p>
          <p className="mt-2 font-mono text-2xl text-primary">{stats.totalUsers}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Tradespeople</p>
          <p className="mt-2 font-mono text-2xl text-primary">{stats.tradespeople}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Verified tradespeople</p>
          <p className="mt-2 font-mono text-2xl text-primary">{stats.verifiedTradespeople}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Customers</p>
          <p className="mt-2 font-mono text-2xl text-primary">{stats.customers}</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>User Management</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-filter" className="text-foreground">
                Role
              </Label>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value as "all" | UserRole);
                  setPage(1);
                }}
              >
                <SelectTrigger id="role-filter">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="tradesperson">Tradesperson</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-search" className="text-foreground">
                Search by email
              </Label>
              <Input
                id="email-search"
                value={emailQuery}
                onChange={(event) => setEmailQuery(event.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-border">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No users found for the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="bg-card">
                      <TableCell className="font-medium text-foreground">
                        {user.displayName || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge className={roleBadgeClass(user.role)}>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.isVerified ? (
                          <Check className="size-4 text-primary" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isUpdating === user.id}
                            >
                              <MoreHorizontal className="size-4" />
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateUser(user.id, { role: "admin" })}>
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateUser(user.id, { role: "tradesperson" })}
                            >
                              Make Tradesperson
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateUser(user.id, { role: "customer" })}>
                              Make Customer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateUser(user.id, { isVerified: !user.isVerified })}
                            >
                              Toggle Verified
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
