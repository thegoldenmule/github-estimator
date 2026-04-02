# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub Estimator is a CLI tool that analyzes a GitHub user's contributions over a time period and estimates the percentage of time spent on different repositories.

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Bun
- **CLI Framework:** Commander.js
- **GitHub API:** Octokit

## Commands

```bash
# Install dependencies
bun install

# Run the CLI
bun run start analyze --user <username>

# Run in watch mode
bun run dev analyze --user <username>

# Run tests
bun test

# Run single test file
bun test tests/contributions.test.ts

# Type check
bun run typecheck
```

## CLI Usage

```bash
# Analyze a user's contributions (last year by default)
bun run start analyze --user octocat

# Specify date range
bun run start analyze --user octocat --since 2024-01-01 --until 2024-12-31

# Export CSV files (summary + per-repo commits)
bun run start report --user octocat --output ./reports

# Generate PDF report from exported CSVs
bun run start pdf --input ./reports --output ./reports/report.pdf
```

Requires `GITHUB_TOKEN` environment variable.

## Architecture

```
src/
├── index.ts              # CLI entry point (Commander setup)
├── commands/
│   ├── analyze.ts        # Analyze command implementation
│   ├── loc.ts            # LOC command implementation
│   ├── report.ts         # CSV export command
│   └── pdf.ts            # PDF generation command
├── services/
│   └── github.ts         # Octokit wrapper for GitHub API
├── analyzers/
│   ├── contributions.ts  # Contribution analysis and formatting
│   └── loc.ts            # LOC analysis and formatting
├── formatters/
│   ├── csv.ts            # CSV read/write (summary + per-repo commits)
│   └── pdf.ts            # PDF generation with pie chart and tables
└── types/
    └── index.ts          # TypeScript interfaces
```

**Data flow:** CLI → Command → GitHub Service → Analyzer → Formatted Output

**Report flow:** `report` command → GitHub API → CSV files → `pdf` command → PDF
