"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useCurrentAuth } from "@/lib/current-auth";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileVideo,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Sparkles,
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
      }

      setUpdatingStatus(false);
    } catch {
      setUpdatingStatus(false);
    }
  }

  const handleFileCountChange = useCallback((count: number) => {
    setProject((current) => (current ? { ...current, fileCount: count } : current));
  }, []);

  if (checkingAuth || !authContext) {
    return (
      <main className="login-shell">
        <p style={{ padding: "2rem" }}>Loading...</p>
      </main>
    );
  }

  const user = { ...authContext.user, role: authContext.membership.role };
  const canEditStatus = user.role !== "CLIENT";
  const initials = getInitials(user.name);

  return (
    <div className="app-shell">
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
            <small>Agency workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav className="main-nav">
          <p className="nav-label">Workspace</p>
          <button className="nav-item" onClick={() => router.push("/")}>
            <LayoutDashboard size={17} />
            Overview
          </button>
          <button className="nav-item active">
            <FolderKanban size={17} />
            Projects
          </button>
          <button className="nav-item" onClick={() => router.push("/clients")}>
            <Users size={17} />
            Clients
          </button>
          <p className="nav-label nav-label-spaced">Manage</p>
          <button className="nav-item">
            <FileVideo size={17} />
            Files
          </button>
          <button className="nav-item">
            <Sparkles size={17} />
            Intake forms
          </button>
          <button className="nav-item">
            <Clock3 size={17} />
            Activity
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <Settings size={17} />
            Settings
          </button>
          <button className="nav-item">
            <CircleHelp size={17} />
            Help center
          </button>
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

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <span>Projects</span>
            <span>/</span>
            <strong>{project ? project.name : "..."}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input placeholder="Search..." disabled />
            </div>
            <button className="icon-button notification-button" aria-label="Notifications">
              <Bell size={18} />
              <i />
            </button>
            <button className="avatar-button">{initials}</button>
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

          {loading && <p>Loading project...</p>}
          {error && <p style={{ color: "#991b1b" }}>{error}</p>}

          {!loading && !error && project && (
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
                ) : (
                  <span className="project-stage-label">
                    {projectStageLabels[project.canonicalStatus]}
                  </span>
                )}
              </div>

              <section className="metric-grid">
                <div className="metric-card">
                  <p>Client</p>
                  <strong style={{ fontSize: "1.1rem" }}>{project.client.name}</strong>
                  <span className="metric-trend">{project.client.email}</span>
                </div>
                <div className="metric-card">
                  <p>Delivery date</p>
                  <strong style={{ fontSize: "1.1rem" }}>{formatDate(project.deliveryDate)}</strong>
                </div>
                <div className="metric-card">
                  <p>Budget</p>
                  <strong style={{ fontSize: "1.1rem" }}>{formatMoney(project.budgetCents)}</strong>
                </div>
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
              <ReviewPanel projectId={projectId} canPublish={user.role === "OWNER" || user.role === "ADMIN"} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
