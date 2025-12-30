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
