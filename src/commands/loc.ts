import { Command } from "commander";
import { fetchUserLOCData } from "../services/github";
import { analyzeLOCData, formatLOCResult } from "../analyzers/loc";
import type { LOCGranularity, LOCOptions } from "../types";

export function createLocCommand(): Command {
  const command = new Command("loc")
    .description("Show lines of code changed over time")
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
    .requiredOption(
      "-g, --granularity <month|year>",
      "Time grouping granularity (month or year)"
    )
    .action(async (options: LOCOptions) => {
      try {
        if (
          options.granularity !== "month" &&
          options.granularity !== "year"
        ) {
          console.error(
            "Error: Granularity must be 'month' or 'year'"
          );
          process.exit(1);
        }

        const sinceStr = options.since ?? getDefaultSinceDate();
        const untilStr = options.until ?? getTodayDate();
        const since = new Date(sinceStr);
        const until = new Date(untilStr);
        const granularity: LOCGranularity = options.granularity;

        console.log(
          `Fetching LOC data for ${options.user}... (this may take a while)`
        );

        const locData = await fetchUserLOCData(options.user, since, until);

        if (locData.length === 0) {
          console.log("No LOC data found for the specified period.");
          return;
        }

        const result = analyzeLOCData(
          locData,
          options.user,
          sinceStr,
          untilStr,
          granularity
        );

        console.log("\n" + formatLOCResult(result));
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
