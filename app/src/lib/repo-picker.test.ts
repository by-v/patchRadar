import { setPendingRepoUrl, takePendingRepoUrl } from './repo-picker';

describe('repo-picker', () => {
  it('mengembalikan tautan sekali lalu mengosongkannya', () => {
    expect(takePendingRepoUrl()).toBeNull();

    setPendingRepoUrl('https://github.com/pemilik/repo');
    expect(takePendingRepoUrl()).toBe('https://github.com/pemilik/repo');
    expect(takePendingRepoUrl()).toBeNull();
  });
});
