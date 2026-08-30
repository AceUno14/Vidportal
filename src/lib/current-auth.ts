"use client";

import { useCallback, useEffect, useState } from "react";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "CLIENT";

export type CurrentAuthContext = {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  };
  membership: {
    id: string;
    role: WorkspaceRole;
    clientId: string | null;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  memberships: Array<{
    id: string;
    role: WorkspaceRole;
    clientId: string | null;
    workspace: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
};

export function useCurrentAuth() {
  const [data, setData] = useState<CurrentAuthContext | null>(null);
  const [isPending, setIsPending] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/context", { cache: "no-store" });

      if (!response.ok) {
        setData(null);
        return;
      }

      const payload = (await response.json()) as { data: CurrentAuthContext };
      setData(payload.data);
    } catch {
      setData(null);
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    // The initial cookie-session request intentionally hydrates this client-only context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  return { data, isPending, refetch };
}
