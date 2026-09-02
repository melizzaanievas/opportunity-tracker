import { db, tasksTable } from "../db";
import type { OpportunityCategory } from "./scraper";

const JOB_ACTION_PLAN = [
  "Review Job Requirements",
  "Tailor CV",
  "Submit Application",
] as const;

const PERFORMANCE_ACTION_PLAN = [
  "Review Audition Criteria",
  "Prepare Vocal/Performance Reel",
  "Upload Headshot",
] as const;

const GRANT_ACTION_PLAN = [
  "Review Eligibility Criteria",
  "Draft Grant Proposal",
  "Submit Budget Breakdown",
] as const;

function uniqueTaskTitles(titles: readonly string[]): string[] {
  const seen = new Set<string>();
  return titles.flatMap((title) => {
    const cleaned = title.trim();
    const normalized = cleaned.toLocaleLowerCase();
    if (!cleaned || seen.has(normalized)) return [];
    seen.add(normalized);
    return [cleaned];
  });
}

export function getFallbackActionPlanTasks(
  category: OpportunityCategory,
): string[] {
  if (category === "grant") return [...GRANT_ACTION_PLAN];
  if (category === "casting" || category === "singing-competition") {
    return [...PERFORMANCE_ACTION_PLAN];
  }
  return [...JOB_ACTION_PLAN];
}

export function getInitialActionPlanTasks(
  category: OpportunityCategory,
  detectedTasks: readonly string[] = [],
): string[] {
  const specificTasks = uniqueTaskTitles(detectedTasks);
  return specificTasks.length > 0
    ? specificTasks
    : getFallbackActionPlanTasks(category);
}

export async function insertInitialActionPlanTasks(
  opportunityId: number,
  category: OpportunityCategory,
  detectedTasks: readonly string[] = [],
): Promise<number> {
  const titles = getInitialActionPlanTasks(category, detectedTasks);
  if (titles.length === 0) return 0;

  await db.insert(tasksTable).values(
    titles.map((title) => ({
      opportunityId,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    })),
  );
  return titles.length;
}