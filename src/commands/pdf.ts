import { Command } from "commander";
import path from "node:path";
import { readSummaryCSV, readCommitCSVs } from "../formatters/csv";
import { generatePDF } from "../formatters/pdf";
import type { PDFOptions } from "../types";

export function createPDFCommand(): Command {
  const command = new Command("pdf")
    .description("Generate a PDF report from exported CSV files")
    .requiredOption(
      "-i, --input <directory>",
      "Directory containing CSV files from the report command"
    )
    .option(
      "-o, --output <file>",
      "Output PDF file path (default: <input>/report.pdf)"
    )
    .action(async (options: PDFOptions) => {
      try {
        const inputDir = options.input;
        const outputPath =
          options.output ?? path.join(inputDir, "report.pdf");

        console.log(`Reading CSV files from ${inputDir}...`);

        const summary = await readSummaryCSV(inputDir);
        const commitsByRepo = await readCommitCSVs(inputDir);

        console.log(
          `Found ${summary.length} repositories in summary, ${commitsByRepo.size} with commit details`
        );

        console.log(`Generating PDF...`);
        await generatePDF(summary, commitsByRepo, outputPath);

        console.log(`Done! PDF written to ${outputPath}`);
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
