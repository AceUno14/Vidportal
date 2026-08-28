"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileVideo,
  Filter,
  FolderKanban,
  Grid2X2,
  LayoutDashboard,
  List,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
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

type CurrentUser = { id: string; email: string; name: string; role: string };

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

const statusProgress: Record<BackendStatus, number> = {
  BRIEFING: 10,
  IN_PROGRESS: 45,
  CLIENT_REVIEW: 70,
  REVISIONS: 60,
  FINAL_DELIVERY: 90,
  COMPLETED: 100,
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
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeNav, setActiveNav] = useState("Overview");
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

  async function fetchProjects() {
    setLoadingProjects(true);
    setProjectsError("");

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });

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
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    // Authentication is restored from browser storage after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(JSON.parse(storedUser));
    setCheckingAuth(false);
    fetchProjects();
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    router.push("/login");
  }

  async function handleCreateProject() {
    setProjectError("");

    if (!newProjectName || !newClientName || !newClientEmail) {
      setProjectError("Please fill in all fields.");
      return;
    }

    setCreatingProject(true);

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

  if (checkingAuth || !user) {
    return (
      <main className="login-shell">
        <p style={{ padding: "2rem" }}>Loading...</p>
      </main>
    );
  }

  const initials = getInitials(user.name);
  const firstName = user.name.split(" ")[0];
  const visibleProjects = showAll ? filteredProjects : filteredProjects.slice(0, 3);

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
            <strong>Violet House</strong>
            <small>Agency workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav className="main-nav">
          <p className="nav-label">Workspace</p>
          {[[LayoutDashboard, "Overview"], [FolderKanban, "Projects"], [Users, "Clients"]].map(
            ([Icon, label]) => (
              <button
                className={activeNav === label ? "nav-item active" : "nav-item"}
                key={label as string}
                onClick={() => {
                  if (label === "Clients") {
                    router.push("/clients");
                  } else {
                    setActiveNav(label as string);
                  }
                }}
              >
                <Icon size={17} />
                {label as string}
                {label === "Projects" && <span className="nav-count">{realProjects.length}</span>}
              </button>
            )
          )}
          <p className="nav-label nav-label-spaced">Manage</p>
          {[[FileVideo, "Files"], [Sparkles, "Intake forms"], [Clock3, "Activity"]].map(
            ([Icon, label]) => (
              <button
                className={activeNav === label ? "nav-item active" : "nav-item"}
                key={label as string}
                onClick={() => setActiveNav(label as string)}
              >
                <Icon size={17} />
                {label as string}
              </button>
            )
          )}
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
            <strong>{activeNav}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects..."
              />
              <kbd>⌘ K</kbd>
            </div>
            <button className="icon-button notification-button" aria-label="Notifications">
              <Bell size={18} />
              <i />
            </button>
            <button className="avatar-button">{initials}</button>
          </div>
        </header>

        <div className="content-wrap">
          {lastCreated && (
            <div
              style={{
                background: "#dcfce7",
                color: "#166534",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                marginBottom: "1rem",
                fontSize: "0.875rem",
              }}
            >
              ✅ &quot;{lastCreated.name}&quot; was created for {lastCreated.client} and saved to your database.
            </div>
          )}

          <div className="page-intro">
            <div>
              <p className="eyebrow">Wednesday, June 19, 2024</p>
              <h1>
                Good morning, {firstName} <span>✦</span>
              </h1>
              <p className="subtitle">Here&apos;s what&apos;s moving across Violet House today.</p>
            </div>
            <button className="primary-button" onClick={() => setShowNewProject(true)}>
              <Plus size={17} /> New project
            </button>
          </div>

          <section className="metric-grid">
            <div className="metric-card metric-dark">
              <div className="metric-icon">
                <FolderKanban size={18} />
              </div>
              <p>Active projects</p>
              <strong>{realProjects.length}</strong>
              <span className="metric-trend">Real data from your database</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-coral">
                <Check size={18} />
              </div>
              <p>Awaiting your review</p>
              <strong>{realProjects.filter((p) => p.status === "CLIENT_REVIEW").length}</strong>
              <span className="metric-trend">Based on status</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-yellow">
                <Clock3 size={18} />
              </div>
              <p>In progress</p>
              <strong>{realProjects.filter((p) => p.status === "IN_PROGRESS").length}</strong>
              <span className="metric-trend">Based on status</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-green">
                <Sparkles size={18} />
              </div>
              <p>Completed</p>
              <strong>{realProjects.filter((p) => p.status === "COMPLETED").length}</strong>
              <span className="metric-trend">Based on status</span>
            </div>
          </section>

          <section className="projects-section">
            <div className="section-heading">
              <div>
                <h2>Recent projects</h2>
                <p>Your team&apos;s latest work at a glance.</p>
              </div>
              <div className="view-actions">
                <button className="filter-button">
                  <Filter size={15} /> Filter
                </button>
                <button className={showAll ? "view-button active" : "view-button"} aria-label="List view">
                  <List size={17} />
                </button>
                <button className={!showAll ? "view-button active" : "view-button"} aria-label="Grid view">
                  <Grid2X2 size={16} />
                </button>
              </div>
            </div>

            {loadingProjects && <p style={{ padding: "1.5rem" }}>Loading your projects...</p>}

            {projectsError && (
              <p style={{ padding: "1.5rem", color: "#991b1b" }}>{projectsError}</p>
            )}

            {!loadingProjects && !projectsError && realProjects.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                <p style={{ marginBottom: "0.5rem" }}>No projects yet.</p>
                <p style={{ fontSize: "0.875rem" }}>
                  Click &quot;New project&quot; above to create your first one.
                </p>
              </div>
            )}

            {!loadingProjects && !projectsError && realProjects.length > 0 && (
              <>
                <div className="project-table">
                  <div className="table-head">
                    <span>Project</span>
                    <span>Status</span>
                    <span>Due date</span>
                    <span>Progress</span>
                    <span />
                  </div>
                  {visibleProjects.map((project, index) => {
                    const progress = statusProgress[project.status];
                    return (
                      <div
                        className="project-row"
                        key={project.id}
                        onClick={() => router.push(`/projects/${project.id}`)}
                        style={{ cursor: "pointer" }}
                      >
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
                        <div className="progress-cell">
                          <div className="progress-track">
                            <i style={{ width: `${progress}%` }} />
                          </div>
                          <span>{progress}%</span>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`More options for ${project.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
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

          <section className="bottom-grid">
            <div className="activity-panel">
              <div className="section-heading">
                <div>
                  <h2>Latest activity</h2>
                  <p>Recent updates from your workspace.</p>
                </div>
                <button className="text-button">
                  View activity <span>→</span>
                </button>
              </div>
              <p style={{ padding: "1rem 0", color: "#6b7280", fontSize: "0.875rem" }}>
                Activity tracking isn&apos;t built yet — coming soon.
              </p>
            </div>
            <div className="invite-panel">
              <div className="invite-art">
                <div className="invite-shape shape-one" />
                <div className="invite-shape shape-two" />
                <Users size={25} />
              </div>
              <h2>Bring your team in.</h2>
              <p>Invite teammates and clients to keep every project in sync.</p>
              <button className="outline-button">
                <Users size={16} /> Invite people
              </button>
            </div>
          </section>
        </div>
      </main>

      {showNewProject && (
        <div className="modal-backdrop" onClick={() => setShowNewProject(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Project intake</p>
                <h2>Start something new</h2>
              </div>
              <button className="icon-button" aria-label="Close" onClick={() => setShowNewProject(false)}>
                ×
              </button>
            </div>

            <label className="field-label" htmlFor="project-name">Project name</label>
            <input
              className="text-input"
              id="project-name"
              placeholder="e.g. Autumn campaign"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
            />

            <label className="field-label" htmlFor="client-name">Client name</label>
            <input
              className="text-input"
              id="client-name"
              placeholder="e.g. Lumen Coffee"
              value={newClientName}
              onChange={(event) => setNewClientName(event.target.value)}
            />

            <label className="field-label" htmlFor="client-email">Client email</label>
            <input
              className="text-input"
              id="client-email"
              placeholder="client@company.com"
              type="email"
              value={newClientEmail}
              onChange={(event) => setNewClientEmail(event.target.value)}
            />

            {projectError && (
              <p style={{ color: "#991b1b", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                {projectError}
              </p>
            )}

            <button
              className="primary-button modal-submit"
              onClick={handleCreateProject}
              disabled={creatingProject}
            >
              {creatingProject ? "Creating..." : "Create project"} <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
