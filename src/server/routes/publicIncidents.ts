import { Router } from "express";
import { getIncidents } from "../services/incidentsLoader.js";

export const publicIncidentsRouter = Router();

publicIncidentsRouter.get("/api/public/incidents", (_req, res) => {
  // Loader runs once at boot; just return the in-memory list.
  res.json(getIncidents());
});
