import { z } from "zod";

export const createReviewSchema = z.object({
  fileAssetId: z.string().min(1),
  title: z.string().trim().min(1).max(160).optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
  timestampSeconds: z.number().min(0).finite().optional(),
});
