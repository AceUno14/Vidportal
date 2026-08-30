"use client";

import { useEffect, useRef, useState } from "react";
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
  Upload,
  Users,
} from "lucide-react";

type BackendStatus =
  | "BRIEFING"
  | "IN_PROGRESS"
  | "CLIENT_REVIEW"
  | "REVISIONS"
  | "FINAL_DELIVERY"
  | "COMPLETED";

type ApiFile = {
  id: string;
  name: string;
  storageKey: string;
  mimeType: string;
  kind: "VIDEO" | "IMAGE" | "DOCUMENT" | "OTHER";
  sizeBytes: string;
  createdAt: string;
};

type ApiProject = {
  id: string;
  name: string;
  status: BackendStatus;
  deliveryDate: string | null;
  budgetCents: number | null;
  createdAt: string;
  client: { id: string; name: string; email: string; company: string | null };
  files: ApiFile[];
  invoices: { id: string; number: string; status: string; amountCents: number }[];
  comments: { id: string; body: string; author: { name: string }; createdAt: string }[];
};

const statusOptions: { value: BackendStatus; label: string }[] = [
  { value: "BRIEFING", label: "Briefing" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "CLIENT_REVIEW", label: "Client review" },
  { value: "REVISIONS", label: "Revisions" },
  { value: "FINAL_DELIVERY", label: "Final delivery" },
  { value: "COMPLETED", label: "Completed" },
];

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

function formatFileSize(bytes: string) {
  const num = Number(bytes);
  if (num < 1024) return num + " B";
  if (num < 1024 * 1024) return (num / 1024).toFixed(1) + " KB";
  return (num / (1024 * 1024)).toFixed(1) + " MB";
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: authContext, isPending: checkingAuth } = useCurrentAuth();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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

  async function handleDeleteFile(fileId: string, fileName: string) {
    const confirmed = window.confirm("Delete \"" + fileName + "\"? This cannot be undone.");
    if (!confirmed) return;

    try {
      const res = await fetch("/api/projects/" + projectId + "/files/" + fileId, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchProject();
      }
    } catch {
      // Silent fail is fine here; the file list will simply stay as-is.
    }
  }

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

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    setUploadError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/projects/" + projectId + "/files", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Upload failed. Please try again.");
        setUploading(false);
        return;
      }

      setUploading(false);
      fetchProject();
    } catch {
      setUploadError("Could not reach the server. Please try again.");
      setUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (checkingAuth || !authContext) {
    return (
      <main className="login-shell">
        <p style={{ padding: "2rem" }}>Loading...</p>
      </main>
    );
  }

  const user = { ...authContext.user, role: authContext.membership.role };
  const isManager = user.role === "OWNER" || user.role === "ADMIN";
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
                <select
                  value={project.status}
                  disabled={updatingStatus || !canEditStatus}
                  onChange={(event) => handleStatusChange(event.target.value as BackendStatus)}
                  style={{
                    padding: "0.6rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid #d6d3d1",
                    background: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
                  <strong style={{ fontSize: "1.1rem" }}>{project.files.length}</strong>
                </div>
              </section>

              <section className="projects-section">
                <div className="section-heading">
                  <div>
                    <h2>Files</h2>
                    <p>Raw footage, assets, and deliverables for this project.</p>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelected}
                      style={{ display: "none" }}
                    />
                    <button
                      className="primary-button"
                      onClick={() => {
                        if (fileInputRef.current) fileInputRef.current.click();
                      }}
                      disabled={uploading}
                    >
                      <Upload size={16} />
                      {uploading ? " Uploading..." : " Upload file"}
                    </button>
                  </div>
                </div>

                {uploadError && (
                  <p style={{ padding: "0 1.5rem", color: "#991b1b", fontSize: "0.875rem" }}>
                    {uploadError}
                  </p>
                )}

                <p style={{ padding: "0 1.5rem", color: "#9ca3af", fontSize: "0.8rem" }}>
                  25MB limit for now. Larger uploads need cloud storage, coming later.
                </p>

                {project.files.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                    <p>No files uploaded yet.</p>
                  </div>
                ) : (
                  <div style={{ padding: "1rem 1.5rem" }}>
                    {project.files.map((file) => {
                      return (
                        <div
                          key={file.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.75rem 0",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          <div>
                            <a
                              href={file.storageKey}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontWeight: 600, color: "#1a1a1a", textDecoration: "none" }}
                            >
                              {file.name}
                            </a>
                            <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                              {file.kind} - {formatFileSize(file.sizeBytes)} - {formatDate(file.createdAt)}
                            </div>
                          </div>
                          {isManager && (
                            <button
                              onClick={() => handleDeleteFile(file.id, file.name)}
                              style={{
                                background: "none",
                                border: "1px solid #fca5a5",
                                color: "#991b1b",
                                borderRadius: "6px",
                                padding: "0.35rem 0.75rem",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="projects-section">
                <div className="section-heading">
                  <div>
                    <h2>Feedback</h2>
                    <p>Comments and revision notes from the client.</p>
                  </div>
                </div>
                {project.comments.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                    <p>No comments yet.</p>
                  </div>
                ) : (
                  project.comments.map((comment) => (
                    <div className="activity-item" key={comment.id}>
                      <div>
                        <strong>{comment.author.name}</strong>
                        <small>{comment.body}</small>
                      </div>
                      <time>{formatDate(comment.createdAt)}</time>
                    </div>
                  ))
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
