import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');

describe('index.html', () => {
  it('links an SVG favicon that ships in public/', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
    const svgPath = join(root, 'public', 'favicon.svg');
    expect(existsSync(svgPath)).toBe(true);
    expect(readFileSync(svgPath, 'utf8')).toMatch(
      /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
    );
  });
});
