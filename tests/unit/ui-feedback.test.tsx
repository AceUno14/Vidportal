import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewPanel } from "@/features/reviews/review-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function reviewsResponse(reviews: unknown[] = []) {
  return new Response(JSON.stringify({ data: { reviews, videoFiles: [] } }), {
    headers: { "Content-Type": "application/json" },
  });
}

const historicalReview = {
  id: "review-one",
  title: "First cut",
  filename: "cut.mp4",
  version: 1,
  canPlay: false,
  comments: [],
};

describe("review feedback", () => {
  it("distinguishes a failed load from an empty review list and allows retry", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("Connection unavailable"))
      .mockResolvedValueOnce(reviewsResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewPanel projectId="project-one" canPublish={false} canDecide={false} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Connection unavailable");
    expect(screen.queryByText(/No review is available yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload reviews" }));
    expect(await screen.findByText(/No review is available yet/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not ask a client to publish a review", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reviewsResponse()));
    render(<ReviewPanel projectId="project-one" canPublish={false} canDecide={false} />);
    expect(await screen.findByText(/Your team will publish a cut/)).toBeInTheDocument();
    expect(screen.queryByText(/Upload a video in Files/)).not.toBeInTheDocument();
  });

  it("shows unavailable historical playback without an endless loading state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reviewsResponse([historicalReview]));
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewPanel projectId="project-one" canPublish={false} canDecide={false} />);
    expect(await screen.findByText("Playback unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Preparing private playback/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps an unsent note and re-enables submission after a network failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reviewsResponse([historicalReview]))
      .mockRejectedValueOnce(new Error("Connection lost"));
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewPanel projectId="project-one" canPublish={false} canDecide={false} />);
    const note = await screen.findByRole("textbox", { name: "Your note" });
    fireEvent.change(note, { target: { value: "Keep this feedback" } });
    fireEvent.click(screen.getByRole("button", { name: "Post note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    expect(note).toHaveValue("Keep this feedback");
    await waitFor(() => expect(screen.getByRole("button", { name: "Post note" })).toBeEnabled());
  });
});
