"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Play, Send, Video } from "lucide-react";

type Review = { id: string; title: string; filename: string; version: number; canPlay: boolean; comments: { id: string; body: string; timestampSeconds: number | null; author: string }[] };
type ReviewData = { reviews: Review[]; videoFiles: { id: string; originalFilename: string }[] };

function timecode(value: number) { const minutes = Math.floor(value / 60); const seconds = Math.floor(value % 60); return `${minutes}:${String(seconds).padStart(2, "0")}`; }

export function ReviewPanel({ projectId, canPublish }: { projectId: string; canPublish: boolean }) {
  const [data, setData] = useState<ReviewData>({ reviews: [], videoFiles: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const active = data.reviews.find((review) => review.id === selected) ?? data.reviews[0];

  const load = useCallback(async () => { const response = await fetch(`/api/projects/${projectId}/reviews`); if (response.ok) { const result = await response.json(); setData(result.data); setSelected((current) => current ?? result.data.reviews[0]?.id ?? null); } }, [projectId]);
  useEffect(() => {
    // The route change is the intentional refresh boundary for this local panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => { if (!active?.canPlay) return; setPlaybackUrl(null); setPlaybackError(null); void (async () => { const response = await fetch(`/api/projects/${projectId}/reviews/${active.id}/playback`); if (response.ok) { const result = await response.json(); setPlaybackUrl(result.data.url); return; } const result = await response.json().catch(() => null); setPlaybackError(result?.error ?? "Private playback is unavailable for this review version."); })(); }, [active?.id, active?.canPlay, projectId]);

  async function publish(fileAssetId: string) { setSaving(true); const response = await fetch(`/api/projects/${projectId}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileAssetId }) }); setSaving(false); if (response.ok) { await load(); } }
  async function postComment() { if (!active || !comment.trim()) return; setSaving(true); const response = await fetch(`/api/projects/${projectId}/reviews/${active.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment, timestampSeconds: video.current?.currentTime ?? undefined }) }); setSaving(false); if (response.ok) { setComment(""); await load(); } }

  return <section className="review-studio projects-section">
    <div className="section-heading"><div><p className="eyebrow">Review room</p><h2>Watch the cut. Mark the moment.</h2><p>Private playback from your R2 bucket—no streaming service required.</p></div></div>
    {canPublish && data.videoFiles.length > 0 && <div className="review-publish"><span><Video size={17} /> Ready video files</span>{data.videoFiles.map((file) => <button key={file.id} className="secondary-button" disabled={saving} onClick={() => void publish(file.id)}>Publish {file.originalFilename}</button>)}</div>}
    {!active ? <div className="review-empty"><Video size={26} /><p>Upload a video in Files, then publish it here for review.</p></div> : <div className="review-layout">
      <div className="review-player"><div className="review-tabs">{data.reviews.map((review) => <button key={review.id} onClick={() => setSelected(review.id)} className={review.id === active.id ? "active" : ""}>V{review.version}</button>)}</div>{playbackUrl ? <video ref={video} src={playbackUrl} controls playsInline /> : <div className="review-loading">{playbackError ? <><Video size={22} /><strong>Playback unavailable</strong><p>{playbackError}</p></> : <><Play size={22} /> Preparing private playback…</>}</div>}<strong>{active.title}</strong></div>
      <div className="review-comments"><div className="review-comments-title"><MessageSquare size={18} /><strong>Notes</strong></div>{active.comments.length === 0 ? <p className="muted">Add a note at the current playhead.</p> : active.comments.map((item) => <button className="review-note" key={item.id} onClick={() => { if (video.current && item.timestampSeconds !== null) video.current.currentTime = item.timestampSeconds; }}><span>{item.timestampSeconds === null ? "Note" : timecode(item.timestampSeconds)}</span><strong>{item.author}</strong><p>{item.body}</p></button>)}<div className="review-composer"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a note at this moment…" /><button className="primary-button" disabled={saving || !comment.trim()} onClick={() => void postComment()}><Send size={15} /> Post note</button></div></div>
    </div>}
  </section>;
}
