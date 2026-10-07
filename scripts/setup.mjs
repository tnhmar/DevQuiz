import { spawnSync } from 'node:child_process';
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) throw new Error('Node 22.13+ required.');
const run = (args) => {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(['expo', 'install', '--npm', 'expo-router', 'expo-sqlite', 'expo-crypto', 'react-native-safe-area-context', 'react-native-screens', 'expo-linking', 'expo-constants', 'expo-status-bar']);
run(['expo', 'install', '--fix', '--npm']);
console.log('Review and commit the resolved package.json and package-lock.json before release.');
