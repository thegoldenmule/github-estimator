import type {
  ContributionEvent,
  ContributionSummary,
  AnalysisResult,
  ContributionData,
} from "../types";

export function analyzeContributions(
  events: ContributionEvent[],
  user: string,
  since: string,
  until: string
): AnalysisResult {
  const repoContributions = new Map<string, number>();

  for (const event of events) {
    const repoName = event.repo.name;
    const current = repoContributions.get(repoName) || 0;
    repoContributions.set(repoName, current + 1);
  }

  const totalContributions = events.length;

  const breakdown: ContributionSummary[] = Array.from(repoContributions.entries())
    .map(([repo, count]) => ({
      repo,
      count,
      percentage:
        totalContributions > 0
          ? Math.round((count / totalContributions) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    user,
    period: { since, until },
    totalContributions,
    breakdown,
  };
}

export function analyzeContributionData(
  data: ContributionData,
  user: string,
  since: string,
  until: string
): AnalysisResult {
  const breakdown: ContributionSummary[] = data.repositoryContributions
    .map((item) => ({
      repo: item.repo,
      count: item.count,
      percentage:
        data.totalContributions > 0
          ? Math.round((item.count / data.totalContributions) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    user,
    period: { since, until },
    totalContributions: data.totalContributions,
    breakdown,
  };
}

export function formatAnalysisResult(result: AnalysisResult): string {
  const lines: string[] = [
    `GitHub Contributions for ${result.user}`,
    `Period: ${result.period.since} to ${result.period.until}`,
    `Total Contributions: ${result.totalContributions}`,
    "",
    "Breakdown by Repository:",
    "-".repeat(60),
  ];

  for (const item of result.breakdown) {
    const bar = "█".repeat(Math.round(item.percentage / 2));
    lines.push(`${item.repo}`);
    lines.push(`  ${bar} ${item.percentage}% (${item.count} contributions)`);
  }

  return lines.join("\n");
}
