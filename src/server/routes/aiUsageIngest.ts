import { Router } from "express";
import { z } from "zod";
import { getProject } from "../projects.js";
import { recordAiUsage } from "../services/aiUsage.js";

export const aiUsageIngestRouter = Router();

const Body = z.object({
  model: z.string().min(1).max(64),
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  est_cost_cents: z.number().nonnegative(),
});

// One row per AI chat completion, posted by the AI-using projects.
// Body shape mirrors what the OpenAI / Azure OpenAI SDK returns so callers
// can pass through the usage block unchanged.
aiUsageIngestRouter.post("/api/ai-usage/:slug", async (req, res) => {
  const { slug } = req.params;
  const project = getProject(slug);
  if (!project) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad body", details: parsed.error.flatten() });
    return;
  }
  try {
    await recordAiUsage({
      project: slug,
      model: parsed.data.model,
      promptTokens: parsed.data.prompt_tokens,
      completionTokens: parsed.data.completion_tokens,
      estCostCents: parsed.data.est_cost_cents,
    });
  } catch (err) {
    // Swallow + log — telemetry must not surface as a client-visible error.
    console.error("[ai-usage ingest] failed for", slug, err);
  }
  res.status(204).end();
});
