// Check the R2 update feed is complete: every `latest*.yml` is present
// and names the expected version, and every file it lists is reachable
// at the right size with range support (blockmap deltas need ranges).
// Run locally with `npm run verify:feed`, or from the release workflow
// once all three platform uploads have landed.
// see docs/notes/update-feed-migration.md

const feedUrl = (process.env.UPDATE_FEED_URL ?? 'https://updates.scamp.club').replace(/\/$/, '');
const expectedVersion = (process.env.EXPECTED_VERSION ?? '').replace(/^v/, '') || null;
const channels = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml'];

/** The subset of electron-builder's update-info YAML we need. */
const parseUpdateInfo = (text) => {
  const version = text.match(/^version:\s*(\S+)/m)?.[1] ?? null;
  const files = [];
  let current = null;
  for (const line of text.split('\n')) {
    const url = line.match(/^\s*-\s*url:\s*(\S+)/);
    if (url) {
      current = { url: url[1], size: null };
      files.push(current);
      continue;
    }
    const size = line.match(/^\s+size:\s*(\d+)/);
    if (size && current) current.size = Number(size[1]);
    if (/^\S/.test(line) && !line.startsWith('files')) current = null;
  }
  return { version, files };
};

const checkFile = async (name, size) => {
  const res = await fetch(`${feedUrl}/${encodeURIComponent(name)}`, {
    headers: { range: 'bytes=0-0' },
  });
  const total = Number(res.headers.get('content-range')?.split('/')[1] ?? NaN);
  const problems = [];
  if (res.status !== 206) problems.push(`status ${res.status} (want 206 for a ranged GET)`);
  if (size !== null && total !== size) problems.push(`size ${total} (yml says ${size})`);
  return problems;
};

let failed = false;
const rows = [];
for (const channel of channels) {
  const res = await fetch(`${feedUrl}/${channel}`, { cache: 'no-store' });
  if (!res.ok) {
    rows.push([channel, '', `missing (${res.status})`]);
    failed = true;
    continue;
  }
  const info = parseUpdateInfo(await res.text());
  const versionNote =
    expectedVersion && info.version !== expectedVersion
      ? `version ${info.version} (want ${expectedVersion})`
      : `version ${info.version}`;
  if (expectedVersion && info.version !== expectedVersion) failed = true;
  rows.push([channel, '', versionNote]);
  for (const file of info.files) {
    const problems = await checkFile(file.url, file.size);
    if (problems.length > 0) failed = true;
    rows.push(['', file.url, problems.length > 0 ? problems.join('; ') : 'ok']);
  }
}

const widths = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length)));
for (const r of rows) {
  console.log(r.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd());
}
console.log(failed ? `\nFeed at ${feedUrl} is NOT complete.` : `\nFeed at ${feedUrl} is complete.`);
process.exit(failed ? 1 : 0);
