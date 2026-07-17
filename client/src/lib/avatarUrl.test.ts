import { describe, expect, it } from 'vitest';
import { avatarMediumUrl } from './avatarUrl';

describe('avatarMediumUrl', () => {
  it('rewrites a Strava large avatar URL to medium', () => {
    expect(
      avatarMediumUrl(
        'https://dgalywyr863hv.cloudfront.net/pictures/athletes/105494700/36069175/2/large.jpg',
      ),
    ).toBe(
      'https://dgalywyr863hv.cloudfront.net/pictures/athletes/105494700/36069175/2/medium.jpg',
    );
  });

  it('leaves a medium URL untouched', () => {
    expect(avatarMediumUrl('https://cdn.example.com/a/medium.jpg')).toBe(
      'https://cdn.example.com/a/medium.jpg',
    );
  });

  it('leaves URLs without the large.jpg suffix untouched', () => {
    expect(avatarMediumUrl('https://cdn.example.com/a/photo.png')).toBe(
      'https://cdn.example.com/a/photo.png',
    );
    expect(avatarMediumUrl('')).toBe('');
  });
});
