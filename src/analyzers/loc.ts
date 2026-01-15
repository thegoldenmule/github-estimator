import type {
  CommitLOCData,
  LOCGranularity,
  LOCPeriodEntry,
  LOCResult,
} from "../types";

function getGroupKey(date: Date, granularity: LOCGranularity): string {
  if (granularity === "year") {
    return date.getFullYear().toString();
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriodLabel(key: string, granularity: LOCGranularity): string {
  if (granularity === "year") return key;
  const parts = key.split("-");
  const year = parts[0] ?? key;
  const month = parts[1] ?? "01";
  const monthName = new Date(+year, +month - 1).toLocaleString("en", {
    month: "long",
  });
  return `${monthName} ${year}`;
}

export function analyzeLOCData(
  commits: CommitLOCData[],
  user: string,
  since: string,
  until: string,
  granularity: LOCGranularity
): LOCResult {
  const grouped = new Map<
    string,
    { additions: number; deletions: number; commits: number }
  >();

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const commit of commits) {
    const date = new Date(commit.date);
    const key = getGroupKey(date, granularity);

    const existing = grouped.get(key) || { additions: 0, deletions: 0, commits: 0 };
    existing.additions += commit.additions;
    existing.deletions += commit.deletions;
    existing.commits += 1;
    grouped.set(key, existing);

    totalAdditions += commit.additions;
    totalDeletions += commit.deletions;
  }

  const entries: LOCPeriodEntry[] = Array.from(grouped.entries())
    .map(([key, data]) => ({
      periodKey: key,
      period: formatPeriodLabel(key, granularity),
      additions: data.additions,
      deletions: data.deletions,
      total: data.additions + data.deletions,
      net: data.additions - data.deletions,
      commits: data.commits,
    }))
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  return {
    user,
    since,
    until,
    granularity,
    totals: {
      additions: totalAdditions,
      deletions: totalDeletions,
      total: totalAdditions + totalDeletions,
      net: totalAdditions - totalDeletions,
      commits: commits.length,
    },
    entries,
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatSignedNumber(n: number): string {
  const formatted = formatNumber(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

export function formatLOCResult(result: LOCResult): string {
  const lines: string[] = [
    `LOC Changes for ${result.user}`,
    `Period: ${result.since} to ${result.until}`,
    `Granularity: ${result.granularity}`,
    "",
  ];

  if (result.entries.length === 0) {
    lines.push("No LOC data found for the specified period.");
    return lines.join("\n");
  }

  const totalsLabel = "TOTAL";
  const totalsAdditions = formatNumber(result.totals.additions);
  const totalsDeletions = formatNumber(result.totals.deletions);
  const totalsTotal = formatNumber(result.totals.total);
  const totalsNet = formatSignedNumber(result.totals.net);
  const totalsCommits = formatNumber(result.totals.commits);

  const maxPeriodLen = Math.max(
    "Period".length,
    totalsLabel.length,
    ...result.entries.map((e) => e.period.length)
  );
  const maxAddLen = Math.max(
    "Additions".length,
    totalsAdditions.length,
    ...result.entries.map((e) => formatNumber(e.additions).length)
  );
  const maxDelLen = Math.max(
    "Deletions".length,
    totalsDeletions.length,
    ...result.entries.map((e) => formatNumber(e.deletions).length)
  );
  const maxTotalLen = Math.max(
    "Total".length,
    totalsTotal.length,
    ...result.entries.map((e) => formatNumber(e.total).length)
  );
  const maxNetLen = Math.max(
    "Net Change".length,
    totalsNet.length,
    ...result.entries.map((e) => formatSignedNumber(e.net).length)
  );
  const maxCommitsLen = Math.max(
    "Commits".length,
    totalsCommits.length,
    ...result.entries.map((e) => formatNumber(e.commits).length)
  );

  const header = [
    "Period".padEnd(maxPeriodLen),
    "Additions".padStart(maxAddLen),
    "Deletions".padStart(maxDelLen),
    "Total".padStart(maxTotalLen),
    "Net Change".padStart(maxNetLen),
    "Commits".padStart(maxCommitsLen),
  ].join("    ");

  lines.push(header);
  lines.push("-".repeat(header.length));

  for (const entry of result.entries) {
    const row = [
      entry.period.padEnd(maxPeriodLen),
      formatNumber(entry.additions).padStart(maxAddLen),
      formatNumber(entry.deletions).padStart(maxDelLen),
      formatNumber(entry.total).padStart(maxTotalLen),
      formatSignedNumber(entry.net).padStart(maxNetLen),
      formatNumber(entry.commits).padStart(maxCommitsLen),
    ].join("    ");
    lines.push(row);
  }

  lines.push("-".repeat(header.length));
  const totalsRow = [
    totalsLabel.padEnd(maxPeriodLen),
    totalsAdditions.padStart(maxAddLen),
    totalsDeletions.padStart(maxDelLen),
    totalsTotal.padStart(maxTotalLen),
    totalsNet.padStart(maxNetLen),
    totalsCommits.padStart(maxCommitsLen),
  ].join("    ");
  lines.push(totalsRow);

  return lines.join("\n");
}
