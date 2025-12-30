import { Octokit } from "octokit";
import type {
  ContributionEvent,
  ContributionData,
  RepositoryContribution,
  GraphQLUserResponse,
} from "../types";

const CONTRIBUTIONS_QUERY = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
          }
          contributions {
            totalCount
          }
        }
      }
    }
  }
`;

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(
        "GITHUB_TOKEN environment variable is required. " +
          "Create a token at https://github.com/settings/tokens"
      );
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

export async function fetchUserEvents(
  username: string,
  since?: Date,
  until?: Date
): Promise<ContributionEvent[]> {
  const client = getOctokit();
  const events: ContributionEvent[] = [];

  // GitHub Events API returns up to 300 events (10 pages of 30)
  // and only events from the last 90 days
  for (let page = 1; page <= 10; page++) {
    const response = await client.rest.activity.listPublicEventsForUser({
      username,
      per_page: 100,
      page,
    });

    if (response.data.length === 0) break;

    for (const event of response.data) {
      const eventDate = new Date(event.created_at || "");

      if (since && eventDate < since) continue;
      if (until && eventDate > until) continue;

      events.push({
        id: event.id,
        type: event.type || "Unknown",
        repo: { name: event.repo.name },
        created_at: event.created_at || "",
        payload: event.payload as Record<string, unknown>,
      });
    }
  }

  return events;
}

function splitIntoYearChunks(
  since: Date,
  until: Date
): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = [];
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;

  let current = new Date(since);
  while (current < until) {
    const chunkEnd = new Date(
      Math.min(current.getTime() + oneYearMs - 1, until.getTime())
    );
    chunks.push({ from: new Date(current), to: chunkEnd });
    current = new Date(chunkEnd.getTime() + 1);
  }

  return chunks;
}

function aggregateContributions(
  contributions: RepositoryContribution[]
): RepositoryContribution[] {
  const repoMap = new Map<string, RepositoryContribution>();

  for (const contrib of contributions) {
    const existing = repoMap.get(contrib.repo);
    if (existing) {
      existing.count += contrib.count;
    } else {
      repoMap.set(contrib.repo, { ...contrib });
    }
  }

  return Array.from(repoMap.values());
}

export async function fetchUserContributions(
  username: string,
  since: Date,
  until: Date
): Promise<ContributionData> {
  const client = getOctokit();

  const chunks = splitIntoYearChunks(since, until);

  const allContributions: RepositoryContribution[] = [];
  let totalContributions = 0;

  for (const chunk of chunks) {
    const response = await client.graphql<GraphQLUserResponse>(
      CONTRIBUTIONS_QUERY,
      {
        username,
        from: chunk.from.toISOString(),
        to: chunk.to.toISOString(),
      }
    );

    if (!response.user) {
      throw new Error(`User "${username}" not found`);
    }

    const collection = response.user.contributionsCollection;
    totalContributions += collection.contributionCalendar.totalContributions;

    for (const item of collection.commitContributionsByRepository) {
      allContributions.push({
        repo: item.repository.nameWithOwner,
        count: item.contributions.totalCount,
        isPrivate: item.repository.isPrivate,
      });
    }
  }

  const aggregated = aggregateContributions(allContributions);

  return {
    totalContributions,
    repositoryContributions: aggregated,
  };
}
