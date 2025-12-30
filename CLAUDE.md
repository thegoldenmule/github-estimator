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
```

Requires `GITHUB_TOKEN` environment variable.

## Architecture

```
src/
├── index.ts              # CLI entry point (Commander setup)
├── commands/
│   └── analyze.ts        # Analyze command implementation
├── services/
│   └── github.ts         # Octokit wrapper for GitHub API
├── analyzers/
│   └── contributions.ts  # Contribution analysis and formatting
└── types/
    └── index.ts          # TypeScript interfaces
```

**Data flow:** CLI → Command → GitHub Service → Analyzer → Formatted Output
