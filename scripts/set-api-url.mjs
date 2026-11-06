// Writes this machine's LAN IP into apps/mobile/.env.local as EXPO_PUBLIC_API_URL,
// so a phone on the same network can reach the backend. Keeps the existing port
// and every other line in the file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/mobile/.env.local');
const KEY = 'EXPO_PUBLIC_API_URL';
const DEFAULT_PORT = 1017;
const VIRTUAL_ADAPTER = /vethernet|virtualbox|vmware|wsl|hyper-v|docker|loopback|tailscale|zerotier|vpn/i;

function isPrivate(ip) {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

function findLanIp() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      candidates.push({ name, address: a.address });
    }
  }
  const rank = c => (isPrivate(c.address) ? 0 : 2) + (VIRTUAL_ADAPTER.test(c.name) ? 1 : 0);
  candidates.sort((a, b) => rank(a) - rank(b));
  return candidates[0]?.address;
}

const ip = findLanIp();
if (!ip) {
  console.warn(`[set-api-url] No LAN IP found, leaving ${KEY} unchanged.`);
  process.exit(0);
}

const existing = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
const lineRe = new RegExp(`^${KEY}=.*$`, 'm');
const port = existing.match(new RegExp(`^${KEY}=.*:(\\d+)\\s*$`, 'm'))?.[1] ?? DEFAULT_PORT;
const line = `${KEY}=http://${ip}:${port}`;

const next = lineRe.test(existing)
  ? existing.replace(lineRe, line)
  : `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${line}\n`;

if (next !== existing) fs.writeFileSync(ENV_FILE, next);
console.log(`[set-api-url] ${line}`);
