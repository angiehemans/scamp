import { describe, it, expect } from 'vitest';

import { describeUpdateError } from '../src/renderer/src/components/updateError';

describe('describeUpdateError', () => {
  it('maps the macOS Squirrel code-signature failure to a reinstall hint', () => {
    const raw =
      'Code signature at URL file:///Users/x/Library/Caches/com.scamp.app.ShipIt/update.X/Scamp.app/ did not pass validation: code failed to satisfy specified code requirement(s)';
    expect(describeUpdateError(raw)).toBe(
      "Update couldn't be verified — reinstall Scamp from the latest release on GitHub."
    );
  });

  it('maps a DNS lookup failure to a connection message', () => {
    expect(describeUpdateError('getaddrinfo ENOTFOUND github.com')).toBe(
      'Update failed — check your connection.'
    );
  });

  it('maps a Chromium net error to a connection message', () => {
    expect(describeUpdateError('net::ERR_INTERNET_DISCONNECTED')).toBe(
      'Update failed — check your connection.'
    );
  });

  it('falls back to the raw message for an unrecognised error', () => {
    expect(describeUpdateError('Cannot find latest-mac.yml in the latest release')).toBe(
      'Update failed: Cannot find latest-mac.yml in the latest release'
    );
  });

  it('returns a generic line for an empty message', () => {
    expect(describeUpdateError('   ')).toBe('Update failed.');
  });
});
