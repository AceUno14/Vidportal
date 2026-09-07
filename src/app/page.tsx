"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FormDialog } from "./form-dialog";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useCurrentAuth } from "@/lib/current-auth";
import {
  Check,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

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
  deliveryDate: string | null;
  createdAt: string;
  client: { name: string; email: string };
  files: { id: string }[];
};

const statusLabels: Record<BackendStatus, string> = {
  BRIEFING: "Briefing",
  IN_PROGRESS: "In progress",
  CLIENT_REVIEW: "Client review",
  REVISIONS: "Revisions",
  FINAL_DELIVERY: "Final delivery",
  COMPLETED: "Completed",
};

const statusStyles: Record<BackendStatus, string> = {
  BRIEFING: "status-briefing",
  IN_PROGRESS: "status-progress",
  CLIENT_REVIEW: "status-review",
  REVISIONS: "status-review",
  FINAL_DELIVERY: "status-delivery",
  COMPLETED: "status-delivery",
};


const avatarColors = ["#f3b562", "#b6c9b9", "#c7b6dd", "#e7a7a1", "#a7c7e7"];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function colorForIndex(index: number) {
  return avatarColors[index % avatarColors.length];
}

function formatDate(dateString: string | null) {
  if (!dateString) return "No due date";
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Home() {
  const router = useRouter();
  const { data: authContext, isPending: checkingAuth } = useCurrentAuth();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [projectError, setProjectError] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ name: string; client: string } | null>(null);

  const [realProjects, setRealProjects] = useState<ApiProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState("");

  const filteredProjects = useMemo(
    () =>
      realProjects.filter((project) =>
        `${project.name} ${project.client.name}`.toLowerCase().includes(query.toLowerCase())
      ),
    [query, realProjects]
  );
  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";

  async function fetchProjects() {
    setLoadingProjects(true);
    setProjectsError("");

    try {
      const res = await fetch("/api/projects");

      const data = await res.json();

      if (!res.ok) {
        setProjectsError(data.error ?? "Could not load projects.");
        setLoadingProjects(false);
        return;
      }

      setRealProjects(data.data);
      setLoadingProjects(false);
    } catch {
      setProjectsError("Could not reach the server.");
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    if (checkingAuth) return;

    if (!authContext) {
      router.replace("/login");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProjects();
    // Projects are refreshed when the authenticated workspace changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authContext?.workspace.id, checkingAuth, router]);

  async function handleLogout() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function handleCreateProject() {
    setProjectError("");

    if (!newProjectName || !newClientName || !newClientEmail) {
      setProjectError("Please fill in all fields.");
      return;
    }

    setCreatingProject(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newProjectName,
          clientName: newClientName,
          clientEmail: newClientEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProjectError(data.error ?? "Something went wrong. Please try again.");
        setCreatingProject(false);
        return;
      }

      setLastCreated({ name: data.data.name, client: data.data.client.name });
      setNewProjectName("");
      setNewClientName("");
      setNewClientEmail("");
      setCreatingProject(false);
      setShowNewProject(false);
      fetchProjects();
    } catch {
      setProjectError("Could not reach the server. Please try again.");
      setCreatingProject(false);
    }
  }

  if (checkingAuth || !authContext) {
    return (
      <main className="page-loading">
        <p role="status">Loading your workspace...</p>
      </main>
    );
  }

  const user = { ...authContext.user, role: authContext.membership.role };
  const isManager = user.role === "OWNER" || user.role === "ADMIN";
  const initials = getInitials(user.name);
  const firstName = user.name.split(" ")[0];
  const visibleProjects = showAll ? filteredProjects : filteredProjects.slice(0, 3);

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
          <Link href="/" className="nav-item active" aria-current="page"><LayoutDashboard size={17} />Overview</Link>
          <Link href="/#projects" className="nav-item"><FolderKanban size={17} />Projects</Link>
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
            <strong>Overview</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                aria-label="Search projects"
                placeholder="Search projects..."
              />
            </div>
            <span className="avatar-button" aria-label={user.name}>{initials}</span>
          </div>
        </header>

        <div className="content-wrap">
          {lastCreated && (
            <div
              role="status"
              style={{
                background: "#dcfce7",
                color: "#166534",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                marginBottom: "1rem",
                fontSize: "0.875rem",
              }}
            >
              &quot;{lastCreated.name}&quot; was created for {lastCreated.client}.
            </div>
          )}

          <div className="page-intro">
            <div>
              <p className="eyebrow" suppressHydrationWarning>
                {todayLabel}
              </p>
              <h1 suppressHydrationWarning>
                {greeting}, {firstName} <span>✦</span>
              </h1>
              <p className="subtitle">
                Here&apos;s what&apos;s moving across {authContext.workspace.name} today.
              </p>
            </div>
            {isManager && (
              <button className="primary-button" onClick={() => setShowNewProject(true)}>
                <Plus size={17} /> New project
              </button>
            )}
          </div>

          <section className="metric-grid">
            <div className="metric-card metric-dark">
              <div className="metric-icon">
                <FolderKanban size={18} />
              </div>
              <p>Total projects</p>
              <strong>{loadingProjects || projectsError ? "—" : realProjects.length}</strong>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-coral">
                <Check size={18} />
              </div>
              <p>Client review</p>
              <strong>{loadingProjects || projectsError ? "—" : realProjects.filter((p) => p.status === "CLIENT_REVIEW").length}</strong>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-yellow">
                <Clock3 size={18} />
              </div>
              <p>In progress</p>
              <strong>{loadingProjects || projectsError ? "—" : realProjects.filter((p) => p.status === "IN_PROGRESS").length}</strong>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-green">
                <Sparkles size={18} />
              </div>
              <p>Completed</p>
              <strong>{loadingProjects || projectsError ? "—" : realProjects.filter((p) => p.status === "COMPLETED").length}</strong>
            </div>
          </section>

          <section className="projects-section" id="projects" aria-label="Projects">
            <div className="section-heading">
              <div>
                <h2>Recent projects</h2>
                <p>Your team&apos;s latest work at a glance.</p>
              </div>
            </div>

            {loadingProjects && <p role="status" className="ui-state">Loading your projects...</p>}

            {projectsError && (
              <div className="ui-error" role="alert"><p>{projectsError}</p><button className="outline-button" onClick={() => void fetchProjects()}>Retry projects</button></div>
            )}

            {!loadingProjects && !projectsError && realProjects.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                <p style={{ marginBottom: "0.5rem" }}>No projects yet.</p>
                <p style={{ fontSize: "0.875rem" }}>
                  {isManager
                    ? "Click \"New project\" above to create your first one."
                    : "No projects are currently available to your account."}
                </p>
              </div>
            )}

            {!loadingProjects && !projectsError && realProjects.length > 0 && filteredProjects.length === 0 && <div className="ui-state" role="status"><h3>No matching projects</h3><p>Try a different project or client name.</p><button className="text-button" onClick={() => setQuery("")}>Clear search</button></div>}

            {!loadingProjects && !projectsError && filteredProjects.length > 0 && (
              <>
                <div className="project-table project-list">
                  <div className="table-head">
                    <span>Project</span>
                    <span>Status</span>
                    <span>Due date</span>
                  </div>
                  {visibleProjects.map((project, index) => {
                    return (
                      <Link className="project-row" key={project.id} href={`/projects/${project.id}`}>
                        <div className="project-cell">
                          <div
                            className="client-avatar"
                            style={{ backgroundColor: colorForIndex(index) }}
                          >
                            {getInitials(project.client.name)}
                          </div>
                          <div>
                            <strong>{project.name}</strong>
                            <small>
                              {project.client.name} <span>·</span> {project.files.length} file
                              {project.files.length === 1 ? "" : "s"}
                            </small>
                          </div>
                        </div>
                        <div>
                          <span className={`status-pill ${statusStyles[project.status]}`}>
                            <i />
                            {statusLabels[project.status]}
                          </span>
                        </div>
                        <div className="due-date">{formatDate(project.deliveryDate)}</div>
                      </Link>
                    );
                  })}
                </div>
                {filteredProjects.length > 3 && (
                  <button className="see-all" onClick={() => setShowAll(!showAll)}>
                    {showAll ? "Show less" : "View all projects"} <span>→</span>
                  </button>
                )}
              </>
            )}
          </section>

        </div>
      </main>

      {showNewProject && isManager && (
        <FormDialog label="Create project" busy={creatingProject} onClose={() => setShowNewProject(false)} onSubmit={handleCreateProject}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Project intake</p>
                <h2>Start something new</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" disabled={creatingProject} onClick={() => setShowNewProject(false)}>
                ×
              </button>
            </div>

            <label className="field-label" htmlFor="project-name">Project name</label>
            <input
              className="text-input"
              id="project-name"
              required
              placeholder="e.g. Autumn campaign"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
            />

            <label className="field-label" htmlFor="client-name">Client name</label>
            <input
              className="text-input"
              id="client-name"
              required
              placeholder="e.g. Lumen Coffee"
              value={newClientName}
              onChange={(event) => setNewClientName(event.target.value)}
            />

            <label className="field-label" htmlFor="client-email">Client email</label>
            <input
              className="text-input"
              id="client-email"
              required
              placeholder="client@company.com"
              type="email"
              value={newClientEmail}
              onChange={(event) => setNewClientEmail(event.target.value)}
            />

            {projectError && (
              <p role="alert" style={{ color: "#991b1b", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                {projectError}
              </p>
            )}

            <button
              className="primary-button modal-submit"
              type="submit"
              disabled={creatingProject}
            >
              {creatingProject ? "Creating..." : "Create project"} <Plus size={16} />
            </button>
        </FormDialog>
      )}
    </div>
  );
}
