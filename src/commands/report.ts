import { Command } from "commander";
import {
  fetchUserContributions,
  fetchUserCommitDetails,
} from "../services/github";
import { writeSummaryCSV, writeCommitCSVs } from "../formatters/csv";
import type { ReportOptions } from "../types";

export function createReportCommand(): Command {
  const command = new Command("report")
    .description(
      "Export contribution data as CSV files (summary + per-repo commits)"
    )
    .requiredOption("-u, --user <username>", "GitHub username to analyze")
    .option(
      "-s, --since <date>",
      "Start date (ISO format, e.g., 2024-01-01)",
      getDefaultSinceDate()
    )
    .option(
      "-t, --until <date>",
      "End date (ISO format, e.g., 2024-12-31)",
      getTodayDate()
    )
    .option(
      "-o, --output <directory>",
      "Output directory for CSV files",
      "./reports"
    )
    .action(async (options: ReportOptions) => {
      try {
        const sinceStr = options.since ?? getDefaultSinceDate();
        const untilStr = options.until ?? getTodayDate();
        const since = new Date(sinceStr);
        const until = new Date(untilStr);
        const outputDir = options.output ?? "./reports";

        console.log(
          `Fetching data for ${options.user} (${sinceStr} to ${untilStr})...`
        );

        const contributionData = await fetchUserContributions(
          options.user,
          since,
          until
        );

        console.log(
          `Found ${contributionData.totalContributions} contributions across ${contributionData.repositoryContributions.length} repos`
        );
        console.log(`Fetching commit details...`);

        const commits = await fetchUserCommitDetails(
          options.user,
          since,
          until,
          contributionData.repositoryContributions
        );

        console.log(
          `Found ${contributionData.totalContributions} contributions, ${commits.length} commits`
        );

        const summaryPath = await writeSummaryCSV(contributionData, outputDir);
        console.log(`  ${summaryPath}`);

        const commitPaths = await writeCommitCSVs(commits, outputDir);
        for (const p of commitPaths) {
          console.log(`  ${p}`);
        }

        console.log(`\nDone! ${commitPaths.length + 1} files written to ${outputDir}`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error: ${error.message}`);
        } else {
          console.error("An unexpected error occurred");
        }
        process.exit(1);
      }
    });

  return command;
}

function getDefaultSinceDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
