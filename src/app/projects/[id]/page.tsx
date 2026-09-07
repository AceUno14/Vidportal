"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useCurrentAuth } from "@/lib/current-auth";
import {
  ArrowLeft,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { FileTransferPanel } from "@/features/files/file-transfer-panel";
import { IntakePanel } from "@/features/intake/intake-panel";
import { ReviewPanel } from "@/features/reviews/review-panel";

type BackendStatus =
  | "BRIEFING"
  | "IN_PROGRESS"
  | "CLIENT_REVIEW"
  | "REVISIONS"
  | "FINAL_DELIVERY"
  | "COMPLETED";

type ApiProject = {
  id: string;
  name: string;
  status: BackendStatus;
  canonicalStatus:
    | "INTAKE"
    | "READY"
    | "IN_PROGRESS"
    | "CLIENT_REVIEW"
    | "REVISIONS"
    | "FINAL_DELIVERY"
    | "COMPLETED";
  deliveryDate: string | null;
  budgetCents: number | null;
  createdAt: string;
  client: { id: string; name: string; email: string; company: string | null };
  fileCount: number;
  invoices: { id: string; number: string; status: string; amountCents: number }[];
  comments: { id: string; body: string; author: { name: string }; createdAt: string }[];
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map(function (part) {
      return part[0];
    })
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Not set";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(cents: number | null) {
  if (cents === null) return "Not set";
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

const projectStageLabels: Record<ApiProject["canonicalStatus"], string> = {
  INTAKE: "Waiting for brief",
  READY: "Ready for production",
  IN_PROGRESS: "In progress",
  CLIENT_REVIEW: "Client review",
  REVISIONS: "Revisions",
  FINAL_DELIVERY: "Final delivery",
  COMPLETED: "Completed",
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const { data: authContext, isPending: checkingAuth } = useCurrentAuth();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [success, setSuccess] = useState("");

  async function fetchProject() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/projects/" + projectId);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not load this project.");
        setLoading(false);
        return;
      }

      setProject(data.data);
      setLoading(false);
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (checkingAuth) return;

    if (!authContext) {
      router.replace("/login");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProject();
    // Project data is refreshed when the route or authenticated workspace changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authContext?.workspace.id, checkingAuth, projectId, router]);

  async function handleLogout() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function handleStatusChange(newStatus: BackendStatus) {
    setUpdatingStatus(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/projects/" + projectId, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (res.ok) {
        setProject(data.data);
        setSuccess("Production started.");
      } else {
        setError(data.error || "Could not start production. Please try again.");
      }

      setUpdatingStatus(false);
    } catch {
      setError("Could not reach the server. Please try again.");
      setUpdatingStatus(false);
    }
  }

  async function handleCompleteProject() {
    setUpdatingStatus(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "The project could not be completed.");
        return;
      }
      await fetchProject();
      setSuccess("Project completed.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  const handleFileCountChange = useCallback((count: number) => {
    setProject((current) => (current ? { ...current, fileCount: count } : current));
  }, []);

  if (checkingAuth || !authContext) {
    return (
      <main className="page-loading">
        <p role="status">Loading your workspace...</p>
      </main>
    );
  }

  const user = { ...authContext.user, role: authContext.membership.role };
  const canEditStatus = user.role !== "CLIENT";
  const isWorkspaceManager = user.role === "OWNER" || user.role === "ADMIN";
  const initials = getInitials(user.name);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            V<span>.</span>
          </div>
          <span>VIDPORTAL</span>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">V</div>
          <div>
            <strong>{authContext.workspace.name}</strong>
            <small>Workspace</small>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <Link href="/" className="nav-item"><LayoutDashboard size={17} />Overview</Link>
          <Link href="/#projects" className="nav-item active" aria-current="location"><FolderKanban size={17} />Projects</Link>
          <Link href="/clients" className="nav-item"><Users size={17} />Clients</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="profile-avatar">{initials}</div>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <button className="icon-button" aria-label="Sign out" onClick={handleLogout}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <span>Projects</span>
            <span>/</span>
            <strong>{project ? project.name : "Project"}</strong>
          </div>
          <div className="topbar-actions">
            <span className="avatar-button" aria-label={user.name}>{initials}</span>
          </div>
        </header>

        <div className="content-wrap">
          <button
            onClick={() => router.push("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              marginBottom: "1.5rem",
              fontSize: "0.875rem",
            }}
          >
            <ArrowLeft size={16} /> Back to dashboard
          </button>

          {loading && <p className="ui-state" role="status">Loading project...</p>}
          {error && <div className="ui-error" role="alert"><p>{error}</p>{!project && <button className="outline-button" onClick={() => void fetchProject()}>Retry project</button>}</div>}
          {success && <p className="ui-success" role="status">{success}</p>}

          {!loading && project && (
            <div>
              <div className="page-intro">
                <div>
                  <p className="eyebrow">{project.client.name}</p>
                  <h1>{project.name}</h1>
                  <p className="subtitle">Created {formatDate(project.createdAt)}</p>
                </div>
                {project.canonicalStatus === "READY" && canEditStatus ? (
                  <button
                    className="primary-button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange("IN_PROGRESS")}
                  >
                    {updatingStatus ? "Starting..." : "Start production"}
                  </button>
                ) : project.canonicalStatus === "FINAL_DELIVERY" &&
                  isWorkspaceManager ? (
                  <button
                    className="primary-button complete-project-button"
                    disabled={updatingStatus}
                    onClick={() => void handleCompleteProject()}
                  >
                    {updatingStatus ? "Completing..." : "Complete project"}
                  </button>
                ) : (
                  <span className="project-stage-label">
                    {projectStageLabels[project.canonicalStatus]}
                  </span>
                )}
              </div>

              <section className="metric-grid project-summary">
                <div className="metric-card">
                  <p>Client</p>
                  <strong style={{ fontSize: "1.1rem" }}>{project.client.name}</strong>
                  <span className="metric-trend">{project.client.email}</span>
                </div>
                <div className="metric-card">
                  <p>Delivery date</p>
                  <strong style={{ fontSize: "1.1rem" }}>{formatDate(project.deliveryDate)}</strong>
                </div>
                {project.budgetCents !== null && <div className="metric-card"><p>Budget</p><strong style={{ fontSize: "1.1rem" }}>{formatMoney(project.budgetCents)}</strong></div>}
                <div className="metric-card">
                  <p>Files</p>
                  <strong style={{ fontSize: "1.1rem" }}>{project.fileCount}</strong>
                </div>
              </section>

              <IntakePanel
                projectId={projectId}
                role={user.role}
                onProjectReady={() => void fetchProject()}
              />

              <FileTransferPanel
                projectId={projectId}
                onFileCountChange={handleFileCountChange}
              />
              <ReviewPanel projectId={projectId} canPublish={user.role === "OWNER" || user.role === "ADMIN"} canDecide={user.role === "CLIENT" && project.canonicalStatus === "CLIENT_REVIEW"} onDecision={() => void fetchProject()} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
