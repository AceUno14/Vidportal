"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clapperboard,
  RefreshCw,
} from "lucide-react";

import type { IntakeDefinition, IntakeField } from "@/features/intake/schema";
import type { WorkspaceRole } from "@/lib/current-auth";

type IntakeView = {
  project: {
    id: string;
    name: string;
    status:
      | "INTAKE"
      | "READY"
      | "IN_PROGRESS"
      | "CLIENT_REVIEW"
      | "REVISIONS"
      | "FINAL_DELIVERY"
      | "COMPLETED";
  };
  template: { id: string; name: string } | null;
  definition: IntakeDefinition | null;
  submission: {
    id: string;
    sequence: number;
    status: "DRAFT" | "SUBMITTED" | "REOPENED";
    answers: Record<string, unknown>;
    submittedAt: string | null;
    submittedBy: string | null;
  } | null;
  canSubmit: boolean;
};

type AnswerState = Record<string, string | boolean>;

function initialAnswers(definition: IntakeDefinition | null): AnswerState {
  return Object.fromEntries(
    (definition?.fields ?? []).map((field) => [
      field.key,
      field.type === "checkbox" ? false : "",
    ]),
  );
}

function displayAnswer(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Confirmed" : "Not confirmed";
  return typeof value === "string" && value ? value : "Not provided";
}

function answerForRequest(field: IntakeField, value: string | boolean | undefined) {
  if (field.type !== "fileChecklist") return value;
  if (typeof value !== "string") return [];

  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function IntakePanel({
  projectId,
  role,
  onProjectReady,
}: {
  projectId: string;
  role: WorkspaceRole;
  onProjectReady: () => void;
}) {
  const [intake, setIntake] = useState<IntakeView | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadIntake() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/intake`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "The project brief could not be loaded.");
        return;
      }

      setIntake(payload.data);
      setAnswers(initialAnswers(payload.data.definition));
    } catch {
      setError("The project brief could not be loaded. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // The project ID is the server-backed identity for this client panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadIntake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!intake?.definition) return;

    setSubmitting(true);
    setError("");
    setFieldErrors({});

    const requestAnswers = Object.fromEntries(
      intake.definition.fields.map((field) => [
        field.key,
        answerForRequest(field, answers[field.key]),
      ]),
    );

    try {
      const response = await fetch(`/api/projects/${projectId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: requestAnswers }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "The brief was not sent.");
        setFieldErrors(payload.fieldErrors ?? {});
        return;
      }

      setIntake(payload.data);
      onProjectReady();
    } catch {
      setError("The brief was not sent. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="intake-card intake-card-loading" aria-live="polite">
        <div className="intake-loading-line" />
        <div className="intake-loading-line short" />
      </section>
    );
  }

  if (error && !intake) {
    return (
      <section className="intake-card intake-error-card" role="alert">
        <div>
          <p className="eyebrow">Project brief</p>
          <h2>Brief unavailable</h2>
          <p>{error}</p>
        </div>
        <button className="outline-button" onClick={() => void loadIntake()}>
          <RefreshCw size={14} /> Retry
        </button>
      </section>
    );
  }

  if (!intake || (!intake.definition && !intake.submission)) {
    if (role === "CLIENT") return null;

    return (
      <section className="intake-card intake-error-card">
        <div>
          <p className="eyebrow">Project brief</p>
          <h2>No intake form attached</h2>
          <p>Attach a published intake template before inviting the client.</p>
        </div>
      </section>
    );
  }

  const isSubmitted = Boolean(intake.submission);

  return (
    <section className="intake-card">
      <aside className="intake-slate" aria-label="Production readiness">
        <div className="slate-kicker">
          <Clapperboard size={15} /> Production slate
        </div>
        <ol>
          <li className={isSubmitted ? "complete" : "active"}>
            <span>{isSubmitted ? <Check size={13} /> : "01"}</span>
            <div>
              <strong>Client brief</strong>
              <small>{isSubmitted ? "Captured" : "In progress"}</small>
            </div>
          </li>
          <li className={isSubmitted ? "active" : ""}>
            <span>02</span>
            <div>
              <strong>Production ready</strong>
              <small>{isSubmitted ? "Unlocked" : "Waiting"}</small>
            </div>
          </li>
        </ol>
        <p>A complete brief gives the production team one source of truth.</p>
      </aside>

      <div className="intake-body">
        <div className="intake-heading">
          <div>
            <p className="eyebrow">{intake.template?.name ?? "Project brief"}</p>
            <h2>{isSubmitted ? "Production brief" : "Set the direction"}</h2>
            <p>
              {isSubmitted
                ? "The client brief is locked to this project and ready for production."
                : role === "CLIENT"
                  ? "Share the goal, audience, and assets before the edit begins."
                  : "Waiting for the client to complete the production brief."}
            </p>
          </div>
          {isSubmitted && (
            <div className="intake-complete-badge">
              <CheckCircle2 size={15} /> Brief sent
            </div>
          )}
        </div>

        {isSubmitted && intake.definition && intake.submission ? (
          <div className="intake-summary">
            {intake.definition.fields.map((field) => (
              <div key={field.key}>
                <span>{field.label}</span>
                <p>{displayAnswer(intake.submission?.answers[field.key])}</p>
              </div>
            ))}
            <footer>
              Submitted by {intake.submission.submittedBy ?? "the client"}
              {intake.submission.submittedAt
                ? ` on ${new Date(intake.submission.submittedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : ""}
            </footer>
          </div>
        ) : intake.canSubmit && intake.definition ? (
          <form className="intake-form" onSubmit={handleSubmit} noValidate>
            {intake.definition.fields.map((field) => (
              <div className="intake-field" key={field.key}>
                {field.type === "checkbox" ? (
                  <label className="intake-checkbox">
                    <input
                      type="checkbox"
                      checked={answers[field.key] === true}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [field.key]: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                  </label>
                ) : (
                  <>
                    <label htmlFor={`intake-${field.key}`}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>
                    {field.type === "select" ? (
                      <select
                        id={`intake-${field.key}`}
                        value={String(answers[field.key] ?? "")}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        aria-invalid={Boolean(fieldErrors[field.key])}
                      >
                        <option value="">Choose an option</option>
                        {field.options?.map((option) => (
                          <option value={option} key={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "text" ? (
                      <input
                        id={`intake-${field.key}`}
                        value={String(answers[field.key] ?? "")}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        aria-invalid={Boolean(fieldErrors[field.key])}
                      />
                    ) : (
                      <textarea
                        id={`intake-${field.key}`}
                        value={String(answers[field.key] ?? "")}
                        placeholder={
                          field.placeholder ??
                          (field.type === "fileChecklist"
                            ? "List one asset per line"
                            : undefined)
                        }
                        rows={field.type === "fileChecklist" ? 4 : 5}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        aria-invalid={Boolean(fieldErrors[field.key])}
                      />
                    )}
                  </>
                )}
                {field.help && <small>{field.help}</small>}
                {fieldErrors[field.key] && (
                  <p className="intake-field-error">{fieldErrors[field.key]}</p>
                )}
              </div>
            ))}

            {error && (
              <div className="intake-submit-error" role="alert">
                {error}
              </div>
            )}

            <div className="intake-submit-row">
              <p>Answers lock when the brief is sent.</p>
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Sending brief..." : "Send production brief"}
                {!submitting && <ArrowRight size={15} />}
              </button>
            </div>
          </form>
        ) : (
          <div className="intake-waiting">
            <span>Client action required</span>
            <p>The associated client can complete this brief from their project view.</p>
          </div>
        )}
      </div>
    </section>
  );
}
