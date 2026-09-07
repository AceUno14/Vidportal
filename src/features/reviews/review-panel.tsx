"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Play, Send, Video } from "lucide-react";

type Review = { id: string; title: string; filename: string; version: number; canPlay: boolean; comments: { id: string; body: string; timestampSeconds: number | null; author: string }[] };
type ReviewData = { reviews: Review[]; videoFiles: { id: string; originalFilename: string }[] };

function timecode(value: number) { const minutes = Math.floor(value / 60); const seconds = Math.floor(value % 60); return `${minutes}:${String(seconds).padStart(2, "0")}`; }

export function ReviewPanel({ projectId, canPublish, canDecide, onDecision }: { projectId: string; canPublish: boolean; canDecide: boolean; onDecision?: () => void }) {
  const [data, setData] = useState<ReviewData>({ reviews: [], videoFiles: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const active = data.reviews.find((review) => review.id === selected) ?? data.reviews[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/reviews`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load reviews.");
      setData(result.data);
      setSelected((current) => current ?? result.data.reviews[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load reviews. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    // The route change is the intentional refresh boundary for this local panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    let cancelled = false;
    // Clear the previous signed URL when the selected version changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaybackUrl(null);
    setPlaybackError(null);
    if (!active?.canPlay) return;
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/reviews/${active.id}/playback`);
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error ?? "Private playback is unavailable for this version.");
        if (!cancelled) setPlaybackUrl(result.data.url);
      } catch (reason) {
        if (!cancelled) setPlaybackError(reason instanceof Error ? reason.message : "Could not load playback. Please try again.");
      }
    })();
    return () => { cancelled = true; };
  }, [active?.id, active?.canPlay, projectId]);

  async function publish(fileAssetId: string) {
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/projects/${projectId}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileAssetId }) });
      if (!response.ok) { const result = await response.json().catch(() => null); throw new Error(result?.error ?? "The review was not published."); }
      await load();
      setSuccess("Review published.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reach the server. Try publishing again."); }
    finally { setSaving(false); }
  }
  async function postComment() {
    if (!active || !comment.trim()) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/projects/${projectId}/reviews/${active.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment, timestampSeconds: video.current?.currentTime ?? undefined }) });
      if (!response.ok) { const result = await response.json().catch(() => null); throw new Error(result?.error ?? "Your note was not posted."); }
      setComment("");
      await load();
      setSuccess("Note posted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reach the server. Your note has been kept."); }
    finally { setSaving(false); }
  }
  async function decide(decision: "APPROVED" | "CHANGES_REQUESTED") {
    if (!active) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/projects/${projectId}/reviews/${active.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      if (!response.ok) { const result = await response.json().catch(() => null); throw new Error(result?.error ?? "Your decision was not saved."); }
      await load();
      setSuccess(decision === "APPROVED" ? "Cut approved." : "Changes requested.");
      onDecision?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reach the server. Please try again."); }
    finally { setSaving(false); }
  }

  return <section className="review-studio projects-section">
    <div className="section-heading"><div><p className="eyebrow">Review room</p><h2>Watch the cut. Mark the moment.</h2><p>Watch review versions and leave notes at the right moment.</p></div></div>
    {error && <div className="ui-error" role="alert"><p>{error}</p><button className="outline-button" disabled={saving || loading} onClick={() => void load()}>Reload reviews</button></div>}
    {success && <p className="ui-success" role="status">{success}</p>}
    {loading && <p className="ui-state" role="status">Loading reviews...</p>}
    {canPublish && data.videoFiles.length > 0 && <div className="review-publish"><span><Video size={17} /> Ready video files</span>{data.videoFiles.map((file) => <button key={file.id} className="outline-button" disabled={saving} onClick={() => void publish(file.id)}>Publish {file.originalFilename}</button>)}</div>}
    {!active ? !loading && !error && <div className="review-empty"><Video size={26} /><p>{canPublish ? "Upload a video in Files, then publish it here for review." : "No review is available yet. Your team will publish a cut here when it is ready."}</p></div> : <div className="review-layout">
      <div className="review-player"><div className="review-tabs" role="group" aria-label="Review versions">{data.reviews.map((review) => <button key={review.id} disabled={saving} aria-pressed={review.id === active.id} aria-label={`Version ${review.version}`} onClick={() => setSelected(review.id)} className={review.id === active.id ? "active" : ""}>V{review.version}</button>)}</div>{active.canPlay && playbackUrl ? <video ref={video} src={playbackUrl} aria-label={active.title} onError={() => { setPlaybackUrl(null); setPlaybackError("This video could not be played. Reload the page to request a fresh playback link."); }} controls playsInline /> : <div className="review-loading" role="status">{!active.canPlay || playbackError ? <><Video size={22} /><strong>Playback unavailable</strong><p>{playbackError ?? "This version has no playable video. Its notes remain available below."}</p></> : <><Play size={22} /> Preparing private playback…</>}</div>}<strong>{active.title}</strong></div>
      <div className="review-comments"><div className="review-comments-title"><MessageSquare size={18} /><strong>Notes</strong></div>{active.comments.length === 0 ? <p className="muted">Add a note at the current playhead.</p> : active.comments.map((item) => <button className="review-note" disabled={item.timestampSeconds === null || !playbackUrl || !active.canPlay} key={item.id} onClick={() => { if (video.current && item.timestampSeconds !== null) video.current.currentTime = item.timestampSeconds; }}><span>{item.timestampSeconds === null ? "Note" : timecode(item.timestampSeconds)}</span><strong>{item.author}</strong><p>{item.body}</p></button>)}<div className="review-composer"><label className="field-label" htmlFor="review-comment">Your note</label><textarea id="review-comment" disabled={saving} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a note at this moment…" /><button className="primary-button" disabled={saving || !comment.trim()} onClick={() => void postComment()}><Send size={15} /> {saving ? "Saving..." : "Post note"}</button></div>{canDecide && <div className="review-decision"><strong>Ready to decide?</strong><button disabled={saving} onClick={() => void decide("CHANGES_REQUESTED")}>Request changes</button><button className="primary-button" disabled={saving} onClick={() => void decide("APPROVED")}>Approve cut</button></div>}</div>
    </div>}
  </section>;
}
