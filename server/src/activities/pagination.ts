import { BadRequestException } from '@nestjs/common';

// generous ceilings — the frontend never asks for more than limit=1000, and
// an unbounded take against a 512MB instance is a self-DoS waiting to happen
const MAX_LIMIT = 1000;
const MAX_PAGE = 1_000_000;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export function parsePagination(
  page?: string,
  limit?: string,
): { page: number; limit: number } {
  return {
    page: parseIntParam('page', page, 1, MAX_PAGE) ?? DEFAULT_PAGE,
    limit: parseIntParam('limit', limit, 1, MAX_LIMIT) ?? DEFAULT_LIMIT,
  };
}

function parseIntParam(
  name: string,
  value: string | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(
      `Invalid ${name}. Expected an integer between ${min} and ${max}.`,
    );
  }

  return parsed;
}
