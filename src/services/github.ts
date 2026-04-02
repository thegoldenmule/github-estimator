import { Octokit } from "octokit";
import type {
  ContributionEvent,
  ContributionData,
  RepositoryContribution,
  GraphQLUserResponse,
  CommitLOCData,
  CommitDetail,
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

  // Use monthly chunks to stay under the maxRepositories:100 limit per query
  const chunks = splitIntoMonthChunks(since, until);

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

interface SearchCommitItem {
  sha: string;
  commit: {
    author: {
      date: string;
    };
    message: string;
  };
  repository: {
    full_name: string;
  };
}

interface SearchCommitsResponse {
  total_count: number;
  incomplete_results: boolean;
  items: SearchCommitItem[];
}

function splitIntoMonthChunks(
  since: Date,
  until: Date
): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = [];

  let current = new Date(since);
  while (current < until) {
    const chunkEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const actualEnd = chunkEnd > until ? until : chunkEnd;
    chunks.push({ from: new Date(current), to: actualEnd });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return chunks;
}

export async function fetchUserLOCData(
  username: string,
  since: Date,
  until: Date
): Promise<CommitLOCData[]> {
  const client = getOctokit();
  const results: CommitLOCData[] = [];
  const seenShas = new Set<string>();

  const chunks = splitIntoMonthChunks(since, until);
  let processedChunks = 0;

  for (const chunk of chunks) {
    processedChunks++;
    const sinceStr = chunk.from.toISOString().slice(0, 10);
    const untilStr = chunk.to.toISOString().slice(0, 10);
    const query = `author:${username} committer-date:${sinceStr}..${untilStr}`;

    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await client.request("GET /search/commits", {
        q: query,
        per_page: perPage,
        page,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      const data = response.data as SearchCommitsResponse;

      if (data.items.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of data.items) {
        if (seenShas.has(item.sha)) continue;
        seenShas.add(item.sha);

        const parts = item.repository.full_name.split("/");
        const owner = parts[0];
        const repo = parts[1];

        if (!owner || !repo) continue;

        try {
          const commitResponse = await client.rest.repos.getCommit({
            owner,
            repo,
            ref: item.sha,
          });

          const stats = commitResponse.data.stats;
          if (stats) {
            results.push({
              date: item.commit.author.date,
              additions: stats.additions ?? 0,
              deletions: stats.deletions ?? 0,
            });
          }
        } catch {
          // Skip commits we can't access (private repos, deleted repos, etc.)
          continue;
        }
      }

      if (data.items.length < perPage || page * perPage >= 1000) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Progress indicator
    if (processedChunks % 12 === 0 || processedChunks === chunks.length) {
      console.log(`  Processed ${processedChunks}/${chunks.length} months (${results.length} commits found)`);
    }
  }

  return results;
}

/**
 * Fetches all repos the authenticated user has access to via REST API.
 * This works with fine-grained tokens, unlike GraphQL contributionsCollection.
 */
export async function fetchUserRepos(): Promise<string[]> {
  const client = getOctokit();
  const repos: string[] = [];
  let page = 1;

  while (true) {
    const response = await client.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
      sort: "pushed",
      direction: "desc",
    });

    for (const repo of response.data) {
      repos.push(repo.full_name);
    }

    if (response.data.length < 100) break;
    page++;
  }

  return repos;
}

/**
 * For each repo, fetches all commits by username in the date range using REST API.
 * Returns commits found and skips repos with no commits or access errors.
 */
export async function fetchUserCommitDetails(
  username: string,
  since: Date,
  until: Date,
  repoNames: string[]
): Promise<CommitDetail[]> {
  const client = getOctokit();
  const results: CommitDetail[] = [];

  let processedRepos = 0;
  let reposWithCommits = 0;

  for (const repoFullName of repoNames) {
    processedRepos++;
    const [owner, name] = repoFullName.split("/");
    if (!owner || !name) continue;

    let page = 1;
    let hasMore = true;
    let repoCommits = 0;

    try {
      while (hasMore) {
        const response = await client.rest.repos.listCommits({
          owner,
          repo: name,
          author: username,
          since: since.toISOString(),
          until: until.toISOString(),
          per_page: 100,
          page,
        });

        if (response.data.length === 0) break;

        for (const commit of response.data) {
          results.push({
            sha: commit.sha,
            date: commit.commit.author?.date ?? "",
            repository: repoFullName,
            message: (commit.commit.message ?? "").split("\n")[0] ?? "",
          });
          repoCommits++;
        }

        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status !== 409) {
        // 409 = empty repo, not worth warning about
        console.warn(
          `  Warning: could not access ${repoFullName} (${status ?? "unknown error"}), skipping`
        );
      }
      continue;
    }

    if (repoCommits > 0) reposWithCommits++;

    if (processedRepos % 20 === 0 || processedRepos === repoNames.length) {
      console.log(
        `  Checked ${processedRepos}/${repoNames.length} repos — ${reposWithCommits} with commits (${results.length} total)`
      );
    }
  }

  return results;
}
