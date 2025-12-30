import { describe, expect, test } from "bun:test";
import {
  analyzeContributions,
  analyzeContributionData,
  formatAnalysisResult,
} from "../src/analyzers/contributions";
import type { ContributionEvent, ContributionData } from "../src/types";

describe("analyzeContributions", () => {
  test("returns empty breakdown for no events", () => {
    const result = analyzeContributions([], "testuser", "2024-01-01", "2024-12-31");

    expect(result.user).toBe("testuser");
    expect(result.totalContributions).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  test("calculates correct percentages for single repo", () => {
    const events: ContributionEvent[] = [
      {
        id: "1",
        type: "PushEvent",
        repo: { name: "user/repo1" },
        created_at: "2024-06-01T00:00:00Z",
        payload: {},
      },
      {
        id: "2",
        type: "PushEvent",
        repo: { name: "user/repo1" },
        created_at: "2024-06-02T00:00:00Z",
        payload: {},
      },
    ];

    const result = analyzeContributions(events, "testuser", "2024-01-01", "2024-12-31");

    expect(result.totalContributions).toBe(2);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]!.percentage).toBe(100);
  });

  test("calculates correct percentages for multiple repos", () => {
    const events: ContributionEvent[] = [
      {
        id: "1",
        type: "PushEvent",
        repo: { name: "user/repo1" },
        created_at: "2024-06-01T00:00:00Z",
        payload: {},
      },
      {
        id: "2",
        type: "PushEvent",
        repo: { name: "user/repo1" },
        created_at: "2024-06-02T00:00:00Z",
        payload: {},
      },
      {
        id: "3",
        type: "PushEvent",
        repo: { name: "user/repo2" },
        created_at: "2024-06-03T00:00:00Z",
        payload: {},
      },
    ];

    const result = analyzeContributions(events, "testuser", "2024-01-01", "2024-12-31");

    expect(result.totalContributions).toBe(3);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0]!.repo).toBe("user/repo1");
    expect(result.breakdown[0]!.percentage).toBeCloseTo(66.7, 1);
    expect(result.breakdown[1]!.repo).toBe("user/repo2");
    expect(result.breakdown[1]!.percentage).toBeCloseTo(33.3, 1);
  });

  test("sorts breakdown by count descending", () => {
    const events: ContributionEvent[] = [
      {
        id: "1",
        type: "PushEvent",
        repo: { name: "user/less-active" },
        created_at: "2024-06-01T00:00:00Z",
        payload: {},
      },
      {
        id: "2",
        type: "PushEvent",
        repo: { name: "user/more-active" },
        created_at: "2024-06-02T00:00:00Z",
        payload: {},
      },
      {
        id: "3",
        type: "PushEvent",
        repo: { name: "user/more-active" },
        created_at: "2024-06-03T00:00:00Z",
        payload: {},
      },
    ];

    const result = analyzeContributions(events, "testuser", "2024-01-01", "2024-12-31");

    expect(result.breakdown[0]!.repo).toBe("user/more-active");
    expect(result.breakdown[1]!.repo).toBe("user/less-active");
  });
});

describe("analyzeContributionData", () => {
  test("returns empty breakdown for no contributions", () => {
    const data: ContributionData = {
      totalContributions: 0,
      repositoryContributions: [],
    };

    const result = analyzeContributionData(data, "testuser", "2024-01-01", "2024-12-31");

    expect(result.user).toBe("testuser");
    expect(result.totalContributions).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  test("calculates correct percentages from contribution data", () => {
    const data: ContributionData = {
      totalContributions: 100,
      repositoryContributions: [
        { repo: "user/repo1", count: 70, isPrivate: false },
        { repo: "user/repo2", count: 30, isPrivate: true },
      ],
    };

    const result = analyzeContributionData(data, "testuser", "2024-01-01", "2024-12-31");

    expect(result.totalContributions).toBe(100);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0]!.percentage).toBe(70);
    expect(result.breakdown[1]!.percentage).toBe(30);
  });

  test("sorts breakdown by count descending", () => {
    const data: ContributionData = {
      totalContributions: 100,
      repositoryContributions: [
        { repo: "user/less-active", count: 20, isPrivate: false },
        { repo: "user/more-active", count: 80, isPrivate: false },
      ],
    };

    const result = analyzeContributionData(data, "testuser", "2024-01-01", "2024-12-31");

    expect(result.breakdown[0]!.repo).toBe("user/more-active");
    expect(result.breakdown[1]!.repo).toBe("user/less-active");
  });

  test("sets period correctly", () => {
    const data: ContributionData = {
      totalContributions: 50,
      repositoryContributions: [
        { repo: "user/repo", count: 50, isPrivate: false },
      ],
    };

    const result = analyzeContributionData(data, "testuser", "2024-01-01", "2024-06-30");

    expect(result.period.since).toBe("2024-01-01");
    expect(result.period.until).toBe("2024-06-30");
  });
});

describe("formatAnalysisResult", () => {
  test("formats result with header and breakdown", () => {
    const result = {
      user: "testuser",
      period: { since: "2024-01-01", until: "2024-12-31" },
      totalContributions: 10,
      breakdown: [
        { repo: "user/repo1", count: 7, percentage: 70 },
        { repo: "user/repo2", count: 3, percentage: 30 },
      ],
    };

    const formatted = formatAnalysisResult(result);

    expect(formatted).toContain("GitHub Contributions for testuser");
    expect(formatted).toContain("Total Contributions: 10");
    expect(formatted).toContain("user/repo1");
    expect(formatted).toContain("70%");
  });
});
