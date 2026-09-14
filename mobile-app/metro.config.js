const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro strictly resolves modules from mobile-app's node_modules,
// preventing resolution leakage into parent drive directories (like F:\node_modules).
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;

