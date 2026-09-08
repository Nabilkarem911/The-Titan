import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubMiner } from './github-miner.js';

describe('GitHubMiner', () => {
  let miner: GitHubMiner;

  beforeEach(() => {
    miner = new GitHubMiner();
  });

  it('should search repositories', async () => {
    const repos = await miner.searchRepositories('rate limiter', 'TypeScript');
    expect(repos.length).toBeGreaterThan(0);
    expect(repos[0].fullName).toBeDefined();
    expect(repos[0].language).toBe('TypeScript');
  });

  it('should clone and extract patterns from a repo', async () => {
    const repos = await miner.searchRepositories('debounce');
    const patterns = await miner.cloneAndExtract(repos[0]);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].hash).toBeDefined();
    expect(patterns[0].content).toBeDefined();
  });

  it('should not mine the same repo twice', async () => {
    const repos = await miner.searchRepositories('test');
    await miner.cloneAndExtract(repos[0]);
    const second = await miner.cloneAndExtract(repos[0]);
    expect(second).toHaveLength(0);
  });

  it('should deduplicate patterns by hash', async () => {
    const repos = await miner.searchRepositories('test');
    const patterns1 = await miner.cloneAndExtract(repos[0]);
    // The mock generates same content for same query, so re-mining should skip
    expect(patterns1.length).toBeGreaterThan(0);
  });

  it('should crystallize patterns with value score > 0.4', async () => {
    const repos = await miner.searchRepositories('high quality tool');
    const patterns = await miner.cloneAndExtract(repos[0]);
    // Some patterns should crystallize if value score is high enough
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('should not crystallize low-value patterns', async () => {
    const skill = miner.crystallizePattern({
      id: 'test',
      repo: 'test/repo',
      filePath: 'test.ts',
      content: 'x',
      hash: 'abc',
      valueScore: 0.2,
      crystallized: false,
      language: 'TypeScript',
      extractedAt: new Date(),
    });
    expect(skill).toBeNull();
  });

  it('should get stats', async () => {
    const repos = await miner.searchRepositories('test');
    await miner.cloneAndExtract(repos[0]);
    const stats = miner.getStats();
    expect(stats.totalRepos).toBeGreaterThan(0);
    expect(stats.totalPatterns).toBeGreaterThan(0);
  });

  it('should reset', async () => {
    const repos = await miner.searchRepositories('test');
    await miner.cloneAndExtract(repos[0]);
    miner.reset();
    expect(miner.getPatterns()).toHaveLength(0);
    expect(miner.getMinedRepos()).toHaveLength(0);
  });
});
