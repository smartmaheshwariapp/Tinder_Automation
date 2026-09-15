const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro strictly resolves modules from mobile-app's node_modules,
// preventing resolution leakage into parent drive directories (like F:\node_modules).
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Explicitly block any lookup into parent-level node_modules
if (Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList.push(/[Ff]:[\\/]node_modules[\\/].*/);
} else {
  config.resolver.blockList = [/[Ff]:[\\/]node_modules[\\/].*/];
}

module.exports = config;


