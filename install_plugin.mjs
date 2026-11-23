#!/usr/bin/env node
'use strict';

/**
 * Installer for Antigravity Gemini Pet (v3.0.0)
 * - Optionally installs Electron via npm
 * - Registers the Antigravity Sidecar plugin under ~/.gemini/config/plugins/agy-gemini-pet/
 * - Generates sidecars/pet-daemon/sidecar.json pointing dynamically to this folder
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const opts = {
    skipNpm: false,
    targetDir: path.join(os.homedir(), '.gemini', 'config', 'plugins', 'agy-gemini-pet')
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip-npm') opts.skipNpm = true;
    else if (a === '--target' && argv[i + 1]) opts.targetDir = path.resolve(argv[++i]);
  }
  return opts;
}

function getElectronBinary(repoRoot) {
  if (process.platform === 'win32') {
    return path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  }
  if (process.platform === 'darwin') {
    return path.join(repoRoot, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
  }
  return path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = __dirname;
  const electronBin = getElectronBinary(repoRoot);

  console.log('====================================================');
  console.log('  Gemini 蓝紫猫娘 · Antigravity 悬浮桌宠 v3.0.0 安装器');
  console.log('====================================================');
  console.log(`项目目录：${repoRoot}`);
  console.log(`插件目录：${opts.targetDir}`);

  if (!opts.skipNpm && !fs.existsSync(electronBin)) {
    console.log('\n[1/3] 正在安装 Electron 依赖（首次安装约需 1-2 分钟）...');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const res = spawnSync(npmCmd, ['install'], { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' });
    if (res.status !== 0) {
      console.error('[ERROR] npm install 失败，请确认网络畅通后重试。');
      process.exit(res.status || 1);
    }
  } else {
    console.log('\n[1/3] 跳过 npm install（已存在依赖或传入 --skip-npm）。');
  }

  console.log('[2/3] 正在写入 Antigravity 插件元信息与 Sidecar 配置...');
  const assetsTarget = path.join(opts.targetDir, 'assets');
  const sidecarDir = path.join(opts.targetDir, 'sidecars', 'pet-daemon');
  fs.mkdirSync(assetsTarget, { recursive: true });
  fs.mkdirSync(sidecarDir, { recursive: true });

  fs.copyFileSync(path.join(repoRoot, 'plugin', 'plugin.json'), path.join(opts.targetDir, 'plugin.json'));
  fs.copyFileSync(path.join(repoRoot, 'assets', 'logo.svg'), path.join(assetsTarget, 'logo.svg'));

  const sidecarCfg = {
    display_name: 'Gemini 蓝紫猫娘悬浮挂件',
    description: '随 Antigravity 启动自动拉起透明悬浮监测桌宠，关闭 Antigravity 时自动退出。',
    command: electronBin,
    args: [repoRoot, '--sidecar'],
    restart_policy: 'on-failure'
  };
  fs.writeFileSync(
    path.join(sidecarDir, 'sidecar.json'),
    JSON.stringify(sidecarCfg, null, 2) + '\n',
    'utf8'
  );

  console.log('[3/3] 校验已生成的 Sidecar 配置...');
  const verified = JSON.parse(fs.readFileSync(path.join(sidecarDir, 'sidecar.json'), 'utf8'));
  if (!verified.command || !Array.isArray(verified.args) || verified.args[0] !== repoRoot) {
    throw new Error('sidecar.json 校验失败');
  }

  console.log('\n✅ 安装完成！接下来只需 2 步：');
  console.log('  1. 完全退出并重启一次 Antigravity 桌面端，猫娘就会自动出现在窗口右下角！');
  console.log('  2. 如需单独预览启动，也可直接双击本目录下的 start-widget-silent.vbs 或运行 npm start。');
  console.log('====================================================');
}

main();
