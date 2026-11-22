import express from "express";
import { activities, materials } from "./data";

let failure = process.env.SIM_FAILURE ?? "none";
const app = express();

app.get("/health", (_req, res) => void res.json({ status: "ok", failure }));

// Lets demos and E2E tests trigger provider outages without restarting.
app.post("/__sim/failure/:mode", (req, res) => {
  failure = req.params.mode;
  res.json({ failure });
});

app.use((_req, res, next) => {
  if (failure === "error") return void res.status(500).json({ error: "simulated_failure" });
  if (failure === "rate_limit") return void res.status(429).set("Retry-After", "5").json({ error: "rate_limited" });
  if (failure === "timeout") return; // Never responds, so the caller's timeout fires.
  next();
});

const matches = (item: { skill_code: string; level: number }, query: express.Request["query"]) =>
  item.skill_code === query.skill_code && item.level === Number(query.level);

app.get("/materials", (req, res) => {
  const data = failure === "empty" ? [] : materials.filter((item) => matches(item, req.query) && (!req.query.format || item.format === req.query.format));
  res.json({ data });
});

app.get("/activities", (req, res) => {
  res.json({ data: failure === "empty" ? [] : activities.filter((item) => matches(item, req.query)) });
});

const port = Number(process.env.PORT ?? 4200);
app.listen(port, process.env.HOST ?? "127.0.0.1", () => console.log(JSON.stringify({ service: "provider-sim", port })));
