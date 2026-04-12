import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const platform = process.platform;
const arch = process.arch;
const isWindows = platform === 'win32';
const nodeName = isWindows ? 'node.exe' : 'node';
const nodeExt = isWindows ? '.exe' : '';
const portableDir = resolve(projectRoot, 'release', `portable-${platform}-${arch}`);
const runtimeDir = join(portableDir, 'runtime');
const appDir = join(portableDir, 'app');

const builtMain = resolve(projectRoot, 'build', 'esm', 'main.js');
if (!existsSync(builtMain)) {
	throw new Error('Missing build/esm/main.js. Run `npm run build:bundle` first.');
}

rmSync(portableDir, { recursive: true, force: true });
mkdirSync(runtimeDir, { recursive: true });
mkdirSync(appDir, { recursive: true });

cpSync(process.execPath, join(runtimeDir, nodeName));
cpSync(resolve(projectRoot, 'build', 'esm'), appDir, { recursive: true });
cpSync(resolve(projectRoot, 'node_modules'), join(appDir, 'node_modules'), { recursive: true });

writeFileSync(
	join(appDir, 'package.json'),
	JSON.stringify({ name: 'poke-engine-portable', private: true, type: 'module' }, null, 2) + '\n',
	'utf8',
);

const posixLauncher = `#!/usr/bin/env sh
set -eu
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
"$DIR/runtime/${nodeName}" "$DIR/app/main.js" "$@"
`;

const cmdLauncher = `@echo off
setlocal
set "DIR=%~dp0"
"%DIR%runtime\\node.exe" "%DIR%app\\main.js" %*
`;

const psLauncher = `$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$dir\\runtime\\node.exe" "$dir\\app\\main.js" $args
`;

const launcherPath = join(portableDir, 'poke-engine');
writeFileSync(launcherPath, posixLauncher, 'utf8');
chmodSync(launcherPath, 0o755);
writeFileSync(join(portableDir, 'poke-engine.cmd'), cmdLauncher, 'utf8');
writeFileSync(join(portableDir, 'poke-engine.ps1'), psLauncher, 'utf8');

const readme = `# Portable package

This folder contains a self-contained runtime package for ${platform}-${arch}.

Run:
- macOS/Linux: ./poke-engine --tui
- Windows cmd: poke-engine.cmd --tui
- Windows PowerShell: ./poke-engine.ps1 --tui

Notes:
- Includes bundled Node runtime (${nodeName}).
- No global Node.js installation required on target machine.
`;
writeFileSync(join(portableDir, 'README.txt'), readme, 'utf8');

console.log(`Portable package created: ${portableDir}`);
