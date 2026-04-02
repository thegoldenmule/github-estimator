import { mkdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { CommitDetail, ContributionData, SummaryRow } from "../types";

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCSV(headers: string[], rows: string[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCSVField).join(","));
  }
  return lines.join("\n") + "\n";
}

function repoToFilename(repo: string): string {
  return repo.replace(/\//g, "--") + ".csv";
}

function filenameToRepo(filename: string): string {
  return filename.replace(/\.csv$/, "").replace(/--/, "/");
}

export async function writeSummaryCSV(
  contributionData: ContributionData,
  outputDir: string
): Promise<string> {
  mkdirSync(outputDir, { recursive: true });

  const total = contributionData.totalContributions;
  const rows = contributionData.repositoryContributions
    .sort((a, b) => b.count - a.count)
    .map((rc) => [
      rc.repo,
      String(rc.count),
      total > 0 ? ((rc.count / total) * 100).toFixed(1) : "0.0",
      String(rc.isPrivate),
    ]);

  const csv = toCSV(
    ["Repository", "Contributions", "Percentage", "Private"],
    rows
  );

  const filePath = path.join(outputDir, "summary.csv");
  await Bun.write(filePath, csv);
  return filePath;
}

export async function writeCommitCSVs(
  commits: CommitDetail[],
  outputDir: string
): Promise<string[]> {
  mkdirSync(outputDir, { recursive: true });

  const grouped = new Map<string, CommitDetail[]>();
  for (const commit of commits) {
    const existing = grouped.get(commit.repository) ?? [];
    existing.push(commit);
    grouped.set(commit.repository, existing);
  }

  const filePaths: string[] = [];
  for (const [repo, repoCommits] of grouped) {
    const sorted = repoCommits.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const rows = sorted.map((c) => [c.sha, c.date, c.message]);
    const csv = toCSV(["SHA", "Date", "Message"], rows);

    const filePath = path.join(outputDir, repoToFilename(repo));
    await Bun.write(filePath, csv);
    filePaths.push(filePath);
  }

  return filePaths;
}

export async function readSummaryCSV(inputDir: string): Promise<SummaryRow[]> {
  const filePath = path.join(inputDir, "summary.csv");
  const content = await Bun.file(filePath).text();
  const lines = content.trim().split("\n");

  // Skip header
  return lines.slice(1).map((line) => {
    const fields = parseCSVLine(line);
    return {
      repository: fields[0] ?? "",
      contributions: parseInt(fields[1] ?? "0", 10),
      percentage: parseFloat(fields[2] ?? "0"),
      isPrivate: fields[3] === "true",
    };
  });
}

export async function readCommitCSVs(
  inputDir: string
): Promise<Map<string, CommitDetail[]>> {
  const files = await readdir(inputDir);
  const csvFiles = files.filter(
    (f) => f.endsWith(".csv") && f !== "summary.csv"
  );

  const result = new Map<string, CommitDetail[]>();
  for (const file of csvFiles) {
    const repo = filenameToRepo(file);
    const content = await Bun.file(path.join(inputDir, file)).text();
    const lines = content.trim().split("\n");

    const commits: CommitDetail[] = lines.slice(1).map((line) => {
      const fields = parseCSVLine(line);
      return {
        sha: fields[0] ?? "",
        date: fields[1] ?? "",
        repository: repo,
        message: fields[2] ?? "",
      };
    });

    result.set(repo, commits);
  }

  return result;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}
