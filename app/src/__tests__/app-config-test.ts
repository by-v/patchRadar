import appConfig from '../../app.json';

describe('konfigurasi aplikasi', () => {
  test('identitas PatchRadar terpasang pada app.json', () => {
    expect(appConfig.expo.name).toBe('PatchRadar');
    expect(appConfig.expo.slug).toBe('patchradar');
    expect(appConfig.expo.scheme).toBe('patchradar');
  });
});
