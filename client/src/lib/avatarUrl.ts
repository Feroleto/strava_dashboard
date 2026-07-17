// Strava serves the same avatar at /large.jpg (124px) and /medium.jpg (62px).
// For small renders (e.g. the 30px sidebar chip) the medium file is enough
// even at 2x DPR; falling back to the original URL keeps unknown patterns
// (e.g. avatars hosted outside cloudfront) working untouched.
export function avatarMediumUrl(url: string): string {
  return url.endsWith('/large.jpg')
    ? `${url.slice(0, -'large.jpg'.length)}medium.jpg`
    : url;
}
