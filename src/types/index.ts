export interface ContributionEvent {
  id: string;
  type: string;
  repo: {
    name: string;
  };
  created_at: string;
  payload: Record<string, unknown>;
}

export interface ContributionSummary {
  repo: string;
  count: number;
  percentage: number;
}

export interface AnalysisResult {
  user: string;
  period: {
    since: string;
    until: string;
  };
  totalContributions: number;
  breakdown: ContributionSummary[];
}

export interface AnalyzeOptions {
  user: string;
  since?: string;
  until?: string;
}

// GraphQL API types
export interface GraphQLRepository {
  nameWithOwner: string;
  isPrivate: boolean;
}

export interface CommitContributionsByRepository {
  repository: GraphQLRepository;
  contributions: {
    totalCount: number;
  };
}

export interface ContributionsCollection {
  contributionCalendar: {
    totalContributions: number;
  };
  commitContributionsByRepository: CommitContributionsByRepository[];
}

export interface GraphQLUserResponse {
  user: {
    contributionsCollection: ContributionsCollection;
  } | null;
}

// Intermediate type for analyzer
export interface RepositoryContribution {
  repo: string;
  count: number;
  isPrivate: boolean;
}

export interface ContributionData {
  totalContributions: number;
  repositoryContributions: RepositoryContribution[];
}

// LOC Command types
export type LOCGranularity = "month" | "year";

export interface LOCPeriodEntry {
  period: string; // "March 2024" or "2024"
  periodKey: string; // "2024-03" or "2024" (for sorting)
  additions: number;
  deletions: number;
  total: number; // additions + deletions
  net: number;
  commits: number;
}

export interface LOCResult {
  user: string;
  since: string;
  until: string;
  granularity: LOCGranularity;
  totals: { additions: number; deletions: number; total: number; net: number; commits: number };
  entries: LOCPeriodEntry[];
}

export interface LOCOptions {
  user: string;
  since?: string;
  until?: string;
  granularity: LOCGranularity;
}

export interface CommitLOCData {
  date: string;
  additions: number;
  deletions: number;
}
