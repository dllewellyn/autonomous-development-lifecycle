
import { RepoCloner } from './repo-cloner';
import simpleGit from 'simple-git';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock simple-git
jest.mock('simple-git');
jest.mock('fs', () => ({
  promises: {
    mkdtemp: jest.fn(),
    rm: jest.fn(),
  },
  existsSync: jest.fn(),
}));
jest.mock('os');

describe('RepoCloner', () => {
  let repoCloner: RepoCloner;
  const mockClone = jest.fn();
  const mockSimpleGit = simpleGit as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSimpleGit.mockReturnValue({
      clone: mockClone,
    });
    (fs.promises.mkdtemp as jest.Mock).mockResolvedValue('/tmp/adl-repo-123');
    (os.tmpdir as jest.Mock).mockReturnValue('/tmp');
  });

  it('should clone repository to a temporary directory', async () => {
    repoCloner = new RepoCloner();
    const result = await repoCloner.clone('owner', 'repo', 'main', 'token');

    expect(fs.promises.mkdtemp).toHaveBeenCalledWith(expect.stringContaining('adl-repo-'));
    expect(mockClone).toHaveBeenCalledWith(
      'https://x-access-token:token@github.com/owner/repo.git',
      '/tmp/adl-repo-123',
      ['--depth', '1', '--branch', 'main']
    );
    expect(result).toBe('/tmp/adl-repo-123');
  });

  it('should cleanup on failure', async () => {
    repoCloner = new RepoCloner();
    mockClone.mockRejectedValue(new Error('Clone failed'));
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    await expect(repoCloner.clone('owner', 'repo', 'main', 'token')).rejects.toThrow('Clone failed');

    expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/adl-repo-123', { recursive: true, force: true });
  });

  it('should explicitly clean up directory', async () => {
    repoCloner = new RepoCloner();
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    await repoCloner.cleanup('/tmp/adl-repo-123');

    expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/adl-repo-123', { recursive: true, force: true });
  });
});
