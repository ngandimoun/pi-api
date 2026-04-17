import Conf from "conf";
import { PiApiClient } from "./api-client.js";

type NlpPrefs = {
  /** Cached locale hint for UX copy (not authoritative). */
  last_locale?: string;
};

const prefs = new Conf<NlpPrefs>({ projectName: "pi-cli", cwd: undefined });

export async function planNaturalLanguage(args: {
  query: string;
  changed_files?: string[];
  project_context?: { framework?: string; language?: string };
}) {
  const client = new PiApiClient();
  const prefer_locale = prefs.get("last_locale");

  const plan = await client.nlpPlan({
    query: args.query,
    changed_files: args.changed_files,
    project_context: args.project_context,
    ...(prefer_locale ? { prefer_locale: prefer_locale } : {}),
  });

  // Cache a lightweight preference for follow-ups.
  try {
    prefs.set("last_locale", plan.detected_language.locale);
  } catch {
    /* ignore */
  }

  return plan;
}
