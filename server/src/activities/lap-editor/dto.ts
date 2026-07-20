import { BadRequestException } from '@nestjs/common';
import { LapType } from '@prisma/client';

// ACTIVITY is a detector-only fallback label (no distinct effort found) —
// never offered as a choice for manually edited/created laps
export const EDITABLE_LAP_TYPES: LapType[] = [
  LapType.RUN,
  LapType.WORKOUT,
  LapType.REST,
  LapType.STEADY,
  LapType.WARMUP,
  LapType.COOLDOWN,
];

export type LapSizeMode = 'distance' | 'time';

export interface LapEditInput {
  lapType: LapType;
  sizeMode: LapSizeMode;
  // meters when sizeMode is 'distance', seconds when 'time'
  sizeValue: number;
}

// Manual validation, no class-validator (not used anywhere in this project) —
// same convention as UsersController.update
export function parseLapEditInputs(body: { laps?: unknown }): LapEditInput[] {
  const laps = body?.laps;

  if (!Array.isArray(laps) || laps.length === 0) {
    throw new BadRequestException('laps must be a non-empty array');
  }

  return laps.map((raw, idx) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new BadRequestException(`laps[${idx}] must be an object`);
    }

    const { lapType, sizeMode, sizeValue } = raw as Record<string, unknown>;

    if (
      typeof lapType !== 'string' ||
      !EDITABLE_LAP_TYPES.includes(lapType as LapType)
    ) {
      throw new BadRequestException(
        `laps[${idx}].lapType must be one of: ${EDITABLE_LAP_TYPES.join(', ')}`,
      );
    }

    if (sizeMode !== 'distance' && sizeMode !== 'time') {
      throw new BadRequestException(
        `laps[${idx}].sizeMode must be 'distance' or 'time'`,
      );
    }

    if (
      typeof sizeValue !== 'number' ||
      !Number.isFinite(sizeValue) ||
      sizeValue <= 0
    ) {
      throw new BadRequestException(
        `laps[${idx}].sizeValue must be a positive number`,
      );
    }

    return { lapType: lapType as LapType, sizeMode, sizeValue };
  });
}
