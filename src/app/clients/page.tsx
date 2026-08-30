"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useCurrentAuth } from "@/lib/current-auth";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileVideo,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

type ApiClient = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  createdAt: string;
  _count: { projects: number; users: number };
};

const avatarColors = ["#f3b562", "#b6c9b9", "#c7b6dd", "#e7a7a1", "#a7c7e7"];

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

function colorForIndex(index: number) {
  return avatarColors[index % avatarColors.length];
}

export default function ClientsPage() {
  const router = useRouter();
  const { data: authContext, isPending: checkingAuth } = useCurrentAuth();

  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState("");

  const [showAddClient, setShowAddClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [loginModalClientId, setLoginModalClientId] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [creatingLogin, setCreatingLogin] = useState(false);

  async function fetchClients() {
    setLoadingClients(true);
    setClientsError("");

    try {
      const res = await fetch("/api/clients");

      const data = await res.json();

      if (!res.ok) {
        setClientsError(data.error || "Could not load clients.");
        setLoadingClients(false);
        return;
      }

      setClients(data.data);
      setLoadingClients(false);
    } catch {
      setClientsError("Could not reach the server.");
      setLoadingClients(false);
    }
  }

  useEffect(() => {
    if (checkingAuth) return;

    if (!authContext) {
      router.replace("/login");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchClients();
    // Clients are refreshed when the authenticated workspace changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authContext?.workspace.id, checkingAuth, router]);

  async function handleLogout() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function handleCreateClient() {
    setFormError("");

    if (!newName || !newEmail) {
      setFormError("Name and email are required.");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName, email: newEmail, company: newCompany }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Something went wrong. Please try again.");
        setCreating(false);
        return;
      }

      setNewName("");
      setNewEmail("");
      setNewCompany("");
      setCreating(false);
      setShowAddClient(false);
      fetchClients();
    } catch {
      setFormError("Could not reach the server. Please try again.");
      setCreating(false);
    }
  }

  async function handleCreateLogin() {
    setLoginError("");
    setLoginSuccess("");

    if (!loginPassword || loginPassword.length < 8) {
      setLoginError("Password must be at least 8 characters.");
      return;
    }

    setCreatingLogin(true);

    try {
      const res = await fetch("/api/clients/" + loginModalClientId + "/create-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || "Something went wrong. Please try again.");
        setCreatingLogin(false);
        return;
      }

      setLoginSuccess("Login created for " + data.data.email + ". Share this password with them securely.");
      setLoginPassword("");
      setCreatingLogin(false);
      fetchClients();
    } catch {
      setLoginError("Could not reach the server. Please try again.");
      setCreatingLogin(false);
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
          <button className="nav-item" onClick={() => router.push("/")}>
            <FolderKanban size={17} />
            Projects
          </button>
          <button className="nav-item active">
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
            <strong>Clients</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input placeholder="Search clients..." />
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
          <div className="page-intro">
            <div>
              <p className="eyebrow">Workspace</p>
              <h1>Clients</h1>
              <p className="subtitle">Everyone you work with, in one place.</p>
            </div>
            {isManager && (
              <button className="primary-button" onClick={() => setShowAddClient(true)}>
                <Plus size={17} /> Add client
              </button>
            )}
          </div>

          <section className="projects-section">
            {loadingClients && <p style={{ padding: "1.5rem" }}>Loading your clients...</p>}

            {clientsError && (
              <p style={{ padding: "1.5rem", color: "#991b1b" }}>{clientsError}</p>
            )}

            {!loadingClients && !clientsError && clients.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                <p style={{ marginBottom: "0.5rem" }}>No clients yet.</p>
                <p style={{ fontSize: "0.875rem" }}>
                  {isManager
                    ? "Click \"Add client\" above, or create one while starting a project."
                    : "No client records are currently available to your account."}
                </p>
              </div>
            )}

            {!loadingClients && !clientsError && clients.length > 0 && (
              <div className="project-table">
                <div className="table-head">
                  <span>Client</span>
                  <span>Email</span>
                  <span>Company</span>
                  <span>Projects</span>
                  <span>Portal access</span>
                </div>
                {clients.map((client, index) => (
                  <div className="project-row" key={client.id}>
                    <div className="project-cell">
                      <div
                        className="client-avatar"
                        style={{ backgroundColor: colorForIndex(index) }}
                      >
                        {getInitials(client.name)}
                      </div>
                      <div>
                        <strong>{client.name}</strong>
                      </div>
                    </div>
                    <div className="due-date">{client.email}</div>
                    <div className="due-date">{client.company || "-"}</div>
                    <div className="due-date">{client._count.projects}</div>
                    <div>
                      {client._count.users > 0 ? (
                        <span style={{ color: "#166534", fontSize: "0.8rem", fontWeight: 600 }}>
                          Active
                        </span>
                      ) : isManager ? (
                        <button
                          onClick={() => {
                            setLoginModalClientId(client.id);
                            setLoginError("");
                            setLoginSuccess("");
                            setLoginPassword("");
                          }}
                          style={{
                            background: "none",
                            border: "1px solid #d6d3d1",
                            borderRadius: "6px",
                            padding: "0.3rem 0.7rem",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          Add login
                        </button>
                      ) : (
                        <span style={{ color: "#78716c", fontSize: "0.8rem" }}>Not enabled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {showAddClient && isManager && (
        <div className="modal-backdrop" onClick={() => setShowAddClient(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">New client</p>
                <h2>Add a client</h2>
              </div>
              <button className="icon-button" aria-label="Close" onClick={() => setShowAddClient(false)}>
                ×
              </button>
            </div>

            <label className="field-label" htmlFor="client-add-name">Client name</label>
            <input
              className="text-input"
              id="client-add-name"
              placeholder="e.g. Lumen Coffee"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />

            <label className="field-label" htmlFor="client-add-email">Email</label>
            <input
              className="text-input"
              id="client-add-email"
              placeholder="client@company.com"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />

            <label className="field-label" htmlFor="client-add-company">Company (optional)</label>
            <input
              className="text-input"
              id="client-add-company"
              placeholder="e.g. Lumen Coffee Co."
              value={newCompany}
              onChange={(event) => setNewCompany(event.target.value)}
            />

            {formError && (
              <p style={{ color: "#991b1b", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                {formError}
              </p>
            )}

            <button
              className="primary-button modal-submit"
              onClick={handleCreateClient}
              disabled={creating}
            >
              {creating ? "Adding..." : "Add client"} <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {loginModalClientId && isManager && (
        <div className="modal-backdrop" onClick={() => setLoginModalClientId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Client portal</p>
                <h2>Create a login</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close"
                onClick={() => setLoginModalClientId(null)}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1rem" }}>
              This sets a temporary password for the client to log in and see their own
              projects. Share it with them securely - a proper email invite comes later.
            </p>

            <label className="field-label" htmlFor="client-login-password">
              Temporary password
            </label>
            <input
              className="text-input"
              id="client-login-password"
              type="text"
              placeholder="At least 8 characters"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />

            {loginError && (
              <p style={{ color: "#991b1b", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                {loginError}
              </p>
            )}

            {loginSuccess && (
              <p style={{ color: "#166534", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                {loginSuccess}
              </p>
            )}

            <button
              className="primary-button modal-submit"
              onClick={handleCreateLogin}
              disabled={creatingLogin}
            >
              {creatingLogin ? "Creating..." : "Create login"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
