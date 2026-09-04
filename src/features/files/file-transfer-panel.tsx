"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  Archive,
  Download,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Film,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type UploadPurpose =
  | "SOURCE"
  | "REFERENCE"
  | "ATTACHMENT"
  | "FINAL_DELIVERABLE";

type ProjectFile = {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE" | "DOCUMENT" | "ARCHIVE" | "OTHER";
  purpose: UploadPurpose;
  visibility: "INTERNAL" | "CLIENT" | "PUBLISHED";
  status: "PENDING" | "READY" | "FAILED" | "ARCHIVED" | "DELETED";
  verifiedAt: string | null;
  createdAt: string;
  uploadedBy: string;
  canDownload: boolean;
  canRemove: boolean;
  canPublish: boolean;
  isPublished: boolean;
  upload: {
    id: string;
    type: "SINGLE_PART" | "MULTIPART";
    status: string;
    expiresAt: string;
    canAbort: boolean;
  } | null;
};

type FileList = {
  files: ProjectFile[];
  uploadPurposes: UploadPurpose[];
  canUpload: boolean;
  uploadBlockReason: "PROJECT_COMPLETED" | "STORAGE_FULL" | null;
  storage: {
    quotaBytes: string;
    usedBytes: string;
    remainingBytes: string;
    usagePercent: number;
  };
};

type InitiatedUpload = {
  fileAssetId: string;
  uploadSessionId: string;
  uploadType: "SINGLE_PART" | "MULTIPART";
  uploadUrl: string | null;
  signedUrlExpiresAt: string | null;
  sessionExpiresAt: string;
  partSize: number | null;
};

type RecoveredUpload = {
  uploadType: "SINGLE_PART" | "MULTIPART";
  expectedFilename: string;
  expectedByteSize: string;
  expectedContentType: string;
  partSize: number | null;
  uploadedParts: { partNumber: number; size: number }[];
  uploadUrl: string | null;
  signedUrlExpiresAt: string | null;
  sessionExpiresAt: string;
};

type TransferState = {
  filename: string;
  uploadSessionId: string;
  progress: number;
  message: string;
  cancelling: boolean;
};

const purposeLabels: Record<UploadPurpose, string> = {
  SOURCE: "Source footage",
  REFERENCE: "Creative reference",
  ATTACHMENT: "Project attachment",
  FINAL_DELIVERABLE: "Final deliverable",
};

function formatFileSize(value: string | number) {
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatStorageSize(value: string | number) {
  const bytes = Number(value);
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fileIcon(kind: ProjectFile["kind"]) {
  if (kind === "VIDEO") return <FileVideo size={18} />;
  if (kind === "AUDIO") return <FileAudio size={18} />;
  if (kind === "IMAGE") return <FileImage size={18} />;
  if (kind === "ARCHIVE") return <Archive size={18} />;
  return <FileText size={18} />;
}

async function responsePayload(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "The transfer request failed.");
  }
  if (!payload || !("data" in payload)) {
    throw new Error("The transfer service returned an invalid response.");
  }
  return payload.data;
}

function uploadRequest(
  url: string,
  body: Blob,
  contentType: string | null,
  onProgress: (loaded: number) => void,
  xhrRef: MutableRefObject<XMLHttpRequest | null>,
) {
  return new Promise<string | null>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onerror = () => reject(new Error("The storage connection was interrupted."));
    xhr.onabort = () => reject(new Error("Transfer cancelled."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("ETag"));
      } else {
        reject(new Error(`Storage rejected the transfer (${xhr.status}).`));
      }
    };
    xhr.send(body);
  });
}

export function FileTransferPanel({
  projectId,
  onFileCountChange,
}: {
  projectId: string;
  onFileCountChange: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelRequested = useRef(false);
  const resumeTarget = useRef<ProjectFile | null>(null);
  const [data, setData] = useState<FileList | null>(null);
  const [purpose, setPurpose] = useState<UploadPurpose>("SOURCE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [transfer, setTransfer] = useState<TransferState | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        cache: "no-store",
      });
      const nextData = (await responsePayload(response)) as FileList;
      setData(nextData);
      onFileCountChange(nextData.files.length);
      setPurpose((current) =>
        nextData.uploadPurposes.includes(current)
          ? current
          : (nextData.uploadPurposes[0] ?? "SOURCE"),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Files could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [onFileCountChange, projectId]);

  useEffect(() => {
    // The project ID is the server-authorized identity for this file bay.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFiles();
  }, [loadFiles]);

  async function signPart(uploadSessionId: string, partNumber: number) {
    const response = await fetch(
      `/api/projects/${projectId}/uploads/${uploadSessionId}/part`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partNumber }),
      },
    );
    return responsePayload(response) as Promise<{ url: string }>;
  }

  async function uploadPartWithRetry(
    uploadSessionId: string,
    partNumber: number,
    blob: Blob,
    completedBytes: number,
    totalBytes: number,
  ) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (cancelRequested.current) throw new Error("Transfer cancelled.");
      try {
        const signed = await signPart(uploadSessionId, partNumber);
        const etag = await uploadRequest(
          signed.url,
          blob,
          null,
          (loaded) =>
            setTransfer((current) =>
              current
                ? {
                    ...current,
                    progress: Math.min(
                      99,
                      Math.round(((completedBytes + loaded) / totalBytes) * 100),
                    ),
                    message: `Sending part ${partNumber}`,
                  }
                : current,
            ),
          xhrRef,
        );
        if (!etag) {
          throw new Error(
            "R2 did not expose the part ETag. Check the bucket CORS policy.",
          );
        }
        return;
      } catch (reason) {
        lastError = reason;
        if (cancelRequested.current || attempt === 3) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("A file part could not be uploaded.");
  }

  async function finishUpload(uploadSessionId: string) {
    setTransfer((current) =>
      current
        ? { ...current, progress: 99, message: "Verifying the stored file" }
        : current,
    );
    const response = await fetch(
      `/api/projects/${projectId}/uploads/${uploadSessionId}/complete`,
      { method: "POST" },
    );
    await responsePayload(response);
  }

  async function runTransfer(
    file: File,
    uploadSessionId: string,
    uploadType: "SINGLE_PART" | "MULTIPART",
    uploadUrl: string | null,
    partSize: number | null,
    uploadedParts: { partNumber: number; size: number }[] = [],
  ) {
    cancelRequested.current = false;
    setTransfer({
      filename: file.name,
      uploadSessionId,
      progress: 0,
      message: "Preparing secure transfer",
      cancelling: false,
    });

    if (uploadType === "SINGLE_PART") {
      if (!uploadUrl) throw new Error("The single-part upload URL is missing.");
      await uploadRequest(
        uploadUrl,
        file,
        file.type || "application/octet-stream",
        (loaded) =>
          setTransfer((current) =>
            current
              ? {
                  ...current,
                  progress: Math.min(98, Math.round((loaded / file.size) * 100)),
                  message: "Sending file directly to private storage",
                }
              : current,
          ),
        xhrRef,
      );
    } else {
      if (!partSize) throw new Error("The multipart size is missing.");
      const completedParts = new Set(
        uploadedParts.map((uploaded) => uploaded.partNumber),
      );
      let completedBytes = uploadedParts.reduce(
        (sum, uploaded) => sum + uploaded.size,
        0,
      );
      const totalParts = Math.ceil(file.size / partSize);

      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        if (completedParts.has(partNumber)) continue;
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const blob = file.slice(start, end);
        await uploadPartWithRetry(
          uploadSessionId,
          partNumber,
          blob,
          completedBytes,
          file.size,
        );
        completedBytes += blob.size;
      }
    }

    await finishUpload(uploadSessionId);
  }

  async function startNewTransfer(file: File) {
    const contentType = file.type || "application/octet-stream";
    const response = await fetch(`/api/projects/${projectId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        byteSize: file.size,
        contentType,
        purpose,
      }),
    });
    const initiated = (await responsePayload(response)) as InitiatedUpload;
    await runTransfer(
      file,
      initiated.uploadSessionId,
      initiated.uploadType,
      initiated.uploadUrl,
      initiated.partSize,
    );
  }

  async function resumeTransfer(file: File, target: ProjectFile) {
    if (
      file.name !== target.name ||
      file.size !== Number(target.sizeBytes) ||
      (file.type || "application/octet-stream") !== target.contentType
    ) {
      throw new Error(
        "Choose the same file again—its name, size, and type must match.",
      );
    }
    if (!target.upload) throw new Error("This transfer cannot be resumed.");

    const response = await fetch(
      `/api/projects/${projectId}/uploads/${target.upload.id}`,
      { cache: "no-store" },
    );
    const recovered = (await responsePayload(response)) as RecoveredUpload;
    await runTransfer(
      file,
      target.upload.id,
      recovered.uploadType,
      recovered.uploadUrl,
      recovered.partSize,
      recovered.uploadedParts,
    );
  }

  async function handleFile(file: File) {
    if (transfer) return;
    setError("");

    try {
      const target = resumeTarget.current;
      resumeTarget.current = null;
      if (
        !target &&
        data &&
        BigInt(file.size) > BigInt(data.storage.remainingBytes)
      ) {
        throw new Error(
          `This file needs ${formatStorageSize(file.size)}, but only ${formatStorageSize(data.storage.remainingBytes)} remains under the storage guard.`,
        );
      }
      if (target) await resumeTransfer(file, target);
      else await startNewTransfer(file);
      setTransfer((current) =>
        current
          ? { ...current, progress: 100, message: "Transfer verified" }
          : current,
      );
      await loadFiles();
      setTimeout(() => setTransfer(null), 900);
    } catch (reason) {
      if (!cancelRequested.current) {
        setError(
          reason instanceof Error ? reason.message : "The transfer failed.",
        );
      }
      setTransfer(null);
      await loadFiles();
    } finally {
      xhrRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function cancelTransfer() {
    if (!transfer) return;
    cancelRequested.current = true;
    xhrRef.current?.abort();
    setTransfer((current) =>
      current ? { ...current, cancelling: true, message: "Cancelling transfer" } : current,
    );

    try {
      const response = await fetch(
        `/api/projects/${projectId}/uploads/${transfer.uploadSessionId}/abort`,
        { method: "POST" },
      );
      await responsePayload(response);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The transfer was not cancelled.",
      );
    } finally {
      setTransfer(null);
      await loadFiles();
    }
  }

  async function downloadFile(file: ProjectFile) {
    setBusyFileId(file.id);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${projectId}/files/${file.id}/download`,
        { method: "POST" },
      );
      const signed = (await responsePayload(response)) as { url: string };
      const link = document.createElement("a");
      link.href = signed.url;
      link.download = file.name;
      link.rel = "noopener";
      link.click();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Download could not start.",
      );
    } finally {
      setBusyFileId(null);
    }
  }

  async function removeFile(file: ProjectFile) {
    const confirmed = window.confirm(
      `Remove “${file.name}”? It will be retained for 30 days before permanent cleanup.`,
    );
    if (!confirmed) return;

    setBusyFileId(file.id);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${projectId}/files/${file.id}`,
        { method: "DELETE" },
      );
      await responsePayload(response);
      await loadFiles();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The file was not removed.",
      );
    } finally {
      setBusyFileId(null);
    }
  }

  async function publishFile(file: ProjectFile) {
    setBusyFileId(file.id);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${projectId}/files/${file.id}/publish`,
        { method: "POST" },
      );
      await responsePayload(response);
      await loadFiles();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The final deliverable was not published.",
      );
    } finally {
      setBusyFileId(null);
    }
  }

  function chooseFile(target?: ProjectFile) {
    resumeTarget.current = target ?? null;
    inputRef.current?.click();
  }

  return (
    <section className="transfer-section" aria-labelledby="files-heading">
      <div className="transfer-heading">
        <div>
          <p className="eyebrow">Asset handoff</p>
          <h2 id="files-heading">Files</h2>
          <p>Originals move directly to private storage and appear only after verification.</p>
        </div>
        {data?.canUpload && data.uploadPurposes.length ? (
          <label className="purpose-control">
            <span>File purpose</span>
            <select
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as UploadPurpose)}
              disabled={Boolean(transfer)}
            >
              {data.uploadPurposes.map((option) => (
                <option value={option} key={option}>
                  {purposeLabels[option]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {data ? (
        <div className="storage-guard">
          <div className="storage-guard-copy">
            <span>Private storage guard</span>
            <strong>{formatStorageSize(data.storage.remainingBytes)} available</strong>
          </div>
          <div className="storage-guard-meter">
            <div
              className="storage-guard-track"
              role="progressbar"
              aria-label="Storage used or reserved"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={data.storage.usagePercent}
            >
              <i
                style={{
                  width: `${Math.max(
                    data.storage.usedBytes === "0" ? 0 : 1,
                    data.storage.usagePercent,
                  )}%`,
                }}
              />
            </div>
            <small>
              {formatStorageSize(data.storage.usedBytes)} used or reserved ·{" "}
              {formatStorageSize(data.storage.quotaBytes)} limit
            </small>
          </div>
        </div>
      ) : null}

      {transfer ? (
        <div className="transfer-runway active" aria-live="polite">
          <div className="runway-file-icon"><Film size={21} /></div>
          <div className="runway-progress-copy">
            <strong>{transfer.filename}</strong>
            <span>{transfer.message}</span>
            <div className="runway-track" aria-label={`${transfer.progress}% uploaded`}>
              <i style={{ width: `${transfer.progress}%` }} />
            </div>
          </div>
          <b>{transfer.progress}%</b>
          <button
            className="icon-button"
            type="button"
            aria-label="Cancel transfer"
            disabled={transfer.cancelling}
            onClick={() => void cancelTransfer()}
          >
            {transfer.cancelling ? <LoaderCircle className="spin" size={17} /> : <X size={17} />}
          </button>
        </div>
      ) : data?.canUpload ? (
        <div
          className={`transfer-runway dropzone${dragging ? " dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
        >
          <div className="runway-file-icon"><Upload size={20} /></div>
          <div>
            <strong>Drop a production file here</strong>
            <span>
              Direct private transfer · {formatStorageSize(data.storage.remainingBytes)} available
            </span>
          </div>
          <button className="outline-button" type="button" onClick={() => chooseFile()}>
            Choose file
          </button>
        </div>
      ) : data ? (
        <div className="transfer-runway locked">
          <div className="runway-file-icon"><LockKeyhole size={19} /></div>
          <div>
            <strong>
              {data.uploadBlockReason === "STORAGE_FULL"
                ? "Storage guard reached"
                : "Project files are locked"}
            </strong>
            <span>
              {data.uploadBlockReason === "STORAGE_FULL"
                ? "Clear retained storage or raise the configured limit before adding files."
                : "Completed projects preserve their verified delivery record."}
            </span>
          </div>
        </div>
      ) : (
        <div className="transfer-runway locked" aria-live="polite">
          <div className="runway-file-icon">
            {loading ? <LoaderCircle className="spin" size={19} /> : <RefreshCw size={18} />}
          </div>
          <div>
            <strong>{loading ? "Loading secure transfer" : "Transfer unavailable"}</strong>
            <span>{loading ? "Checking project access and file policy." : "Retry the file list before choosing an asset."}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="transfer-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="asset-register">
        <div className="asset-register-head">
          <span>Project assets</span>
          <small>{data?.files.length ?? 0} total</small>
        </div>

        {loading && !data ? (
          <div className="asset-empty"><LoaderCircle className="spin" size={20} /> Loading files</div>
        ) : !data?.files.length ? (
          <div className="asset-empty">
            <Film size={22} />
            <strong>No project files yet</strong>
            <span>Add the first source, reference, or attachment above.</span>
          </div>
        ) : (
          data.files.map((file) => (
            <article className="asset-row" key={file.id}>
              <div className={`asset-kind kind-${file.kind.toLowerCase()}`}>
                {fileIcon(file.kind)}
              </div>
              <div className="asset-name">
                <strong>{file.name}</strong>
                <span>
                  {formatFileSize(file.sizeBytes)} · {file.uploadedBy} · {formatDate(file.createdAt)}
                </span>
              </div>
              <span className={`asset-status status-${file.status.toLowerCase()}`}>
                {file.isPublished
                  ? "Published"
                  : file.status === "READY"
                    ? "Verified"
                  : file.status === "PENDING"
                    ? "Transfer paused"
                    : "Needs attention"}
              </span>
              <div className="asset-actions">
                {file.canPublish ? (
                  <button
                    className="text-button compact publish-file-button"
                    type="button"
                    disabled={busyFileId === file.id}
                    onClick={() => void publishFile(file)}
                  >
                    {busyFileId === file.id ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Send size={14} />
                    )}
                    Publish to client
                  </button>
                ) : null}
                {file.upload ? (
                  <button
                    className="text-button compact"
                    type="button"
                    onClick={() => chooseFile(file)}
                  >
                    <RotateCcw size={14} /> Resume
                  </button>
                ) : null}
                {file.canDownload ? (
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Download ${file.name}`}
                    disabled={busyFileId === file.id}
                    onClick={() => void downloadFile(file)}
                  >
                    {busyFileId === file.id ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
                  </button>
                ) : null}
                {file.canRemove ? (
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    disabled={busyFileId === file.id}
                    onClick={() => void removeFile(file)}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}

        {error && !data ? (
          <button className="outline-button asset-retry" type="button" onClick={() => void loadFiles()}>
            <RefreshCw size={14} /> Retry file list
          </button>
        ) : null}
      </div>
    </section>
  );
}
