import { Command } from "commander";
import { fetchUserContributions } from "../services/github";
import {
  analyzeContributionData,
  formatAnalysisResult,
} from "../analyzers/contributions";
import type { AnalyzeOptions } from "../types";

export function createAnalyzeCommand(): Command {
  const command = new Command("analyze")
    .description("Analyze a GitHub user's contributions")
    .requiredOption("-u, --user <username>", "GitHub username to analyze")
    .option(
      "-s, --since <date>",
      "Start date (ISO format, e.g., 2024-01-01)",
      getDefaultSinceDate()
    )
    .option(
      "-t, --until <date>",
      "End date (ISO format, e.g., 2024-12-31)",
      new Date().toISOString().slice(0, 10)
    )
    .action(async (options: AnalyzeOptions) => {
      try {
        const sinceStr = options.since ?? getDefaultSinceDate();
        const untilStr = options.until ?? getTodayDate();
        const since = new Date(sinceStr);
        const until = new Date(untilStr);

        console.log(`Fetching contributions for ${options.user}...`);

        const contributionData = await fetchUserContributions(
          options.user,
          since,
          until
        );

        if (contributionData.totalContributions === 0) {
          console.log("No contributions found for the specified period.");
          return;
        }

        const result = analyzeContributionData(
          contributionData,
          options.user,
          sinceStr,
          untilStr
        );

        console.log("\n" + formatAnalysisResult(result));
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
