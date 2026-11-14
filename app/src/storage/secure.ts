/**
 * Penyimpanan nilai sensitif (sesi anonim) di perangkat.
 *
 * Android/iOS memakai `expo-secure-store` (Android Keystore / iOS Keychain).
 * Web tidak memiliki penyimpanan aman yang setara; di sana nilai disimpan di
 * `localStorage` sebagai fallback agar sesi tetap bertahan saat halaman dimuat
 * ulang. APK rilis tetap memakai SecureStore.
 */

import { Platform } from 'react-native';

export interface SecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const WEB_PREFIX = 'patchradar.secure.';
const memoryFallback = new Map<string, string>();

type WebStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function webStorage(): WebStorageLike | null {
  try {
    const candidate = (globalThis as { localStorage?: WebStorageLike }).localStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
}

export const secureStorage: SecureStorage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      const storage = webStorage();
      return storage ? storage.getItem(WEB_PREFIX + key) : (memoryFallback.get(key) ?? null);
    }
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },

  async setItem(key, value) {
    if (Platform.OS === 'web') {
      const storage = webStorage();
      if (storage) storage.setItem(WEB_PREFIX + key, value);
      else memoryFallback.set(key, value);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key) {
    if (Platform.OS === 'web') {
      const storage = webStorage();
      if (storage) storage.removeItem(WEB_PREFIX + key);
      else memoryFallback.delete(key);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
};
