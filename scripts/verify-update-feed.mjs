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

const rangedTotal = async (url) => {
  const res = await fetch(url, { headers: { range: 'bytes=0-0' } });
  return {
    status: res.status,
    total: Number(res.headers.get('content-range')?.split('/')[1] ?? NaN),
    cache: res.headers.get('cf-cache-status'),
  };
};

// Fetch the bare URL — what electron-updater actually requests, since it
// cache-busts only the yml — and a cache-busted copy that reaches the
// origin. A size that differs between the two is a stale edge cache: the
// object was re-uploaded under the same name and Cloudflare still serves
// the old bytes, which fails the updater's sha512 check.
const checkFile = async (name, size) => {
  const url = `${feedUrl}/${encodeURIComponent(name)}`;
  const edge = await rangedTotal(url);
  const problems = [];
  if (edge.status !== 206) {
    problems.push(`status ${edge.status} (want 206 for a ranged GET)`);
    return problems;
  }
  if (size !== null && edge.total !== size) {
    const origin = await rangedTotal(`${url}?noCache=${Date.now().toString(32)}`);
    if (origin.total === size) {
      problems.push(
        `stale edge cache: serving ${edge.total} bytes (cf-cache-status ${edge.cache}), origin has ${size} — purge this URL in Cloudflare or wait for the TTL`
      );
    } else {
      problems.push(`size ${edge.total} (yml says ${size})`);
    }
  }
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
