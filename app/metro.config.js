// Konfigurasi Metro untuk expo-sqlite di web (wasm + SharedArrayBuffer).
// https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#web-setup
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Dukung aset WebAssembly yang dipakai expo-sqlite di peramban.
config.resolver.assetExts.push('wasm');

// Header COEP/COOP diperlukan agar SharedArrayBuffer tersedia.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
