#!/usr/bin/env bun
import { Command } from "commander";
import { createAnalyzeCommand } from "./commands/analyze";
import { createLocCommand } from "./commands/loc";

const program = new Command();

program
  .name("github-estimator")
  .description(
    "Analyze a GitHub user's contributions and estimate time allocation"
  )
  .version("0.1.0");

program.addCommand(createAnalyzeCommand());
program.addCommand(createLocCommand());

program.parse();
