import {
  classifyIntervalLapsType,
} from 'src/strava/sync/detectors/lap-classifier';
import { LapType } from '@prisma/client';
import { describe, it, expect, beforeAll } from "vitest";

function speedLaps(speeds: number[]) {
  return speeds.map((s) => ({ avgSpeed: s }));
}

describe('classifyIntervalLapsType', () => {

    describe('degenerated cases', () => {
        it('returns [RUN] for list with one lap', () => {
            expect(classifyIntervalLapsType(speedLaps([3.5])))
            .toEqual([LapType.RUN]);
        });

        it('returns RUN to all laps when speed is uniform', () => {
            const laps = speedLaps([3.5, 3.51, 3.49, 3.5, 3.5]);
            const result = classifyIntervalLapsType(laps);
            expect(result.every((t) => t === LapType.RUN))
            .toBe(true);
        });
    });

    describe('normal training plan: warmup - intervals - cooldown', () => {
        const speeds = [2.8, 2.8, 4.5, 2.3, 4.5, 2.3, 4.5, 2.3, 4.5, 2.3, 2.8];
        let result: LapType[];

        beforeAll(() => {
            result = classifyIntervalLapsType(speedLaps(speeds));
        });

        it('has correct length', () => {
            expect(result).toHaveLength(speeds.length);
        });

        it('first lap is WARMUP', () => {
            expect(result[0]).toBe(LapType.WARMUP);
        });

        it('last lap is COOLDOWN', () => {
            expect(result[result.length - 1]).toBe(LapType.COOLDOWN);
        });

        it('fast laps are workout', () => {
            [2, 4, 6, 8].forEach((i) => {
                expect(result[i])
                .toBe(LapType.WORKOUT);
            })
        });

        it('slow laps are REST', () => {
            [3, 5, 7, 9].forEach((i) => {
                expect(result[i])
                .toBe(LapType.REST);
            });
        });
    });

    describe('without clear warmup lap - first lap is already WORKOUT lap', () => {
        const speeds = [4.5, 2.5, 4.5, 2.5, 4.5, 2.5, 2.8];
        let result: LapType[];

        beforeAll(() => {
            result = classifyIntervalLapsType(speedLaps(speeds));
        });

        it('first lap is not WARMUP', () => {
            expect(result[0]).not.toBe(LapType.WARMUP);
        });

        it('first lap is WORKOUT', () => {
            expect(result[0]).toBe(LapType.WORKOUT);
        });
    });

    describe ('without clear cooldown - last lap is WORKOUT', () => {
        const speeds = [4.5, 2.5, 4.5, 2.5, 4.5];
        let result: LapType[];

        beforeAll(() => {
            result = classifyIntervalLapsType(speedLaps(speeds));
        });

        it('last lap is not COOLDOWN', () => {
            expect(result[result.length -1]).not.toBe(LapType.COOLDOWN);
        });

        it('last lap is WORKPUT', () => {
            expect(result[result.length -1]).toBe(LapType.WORKOUT);
        });
    })

    describe ('without clear cooldown - last lap is REST', () => {
        const speeds = [4.5, 2.5, 4.5, 2.5, 4.5, 2.5];
        let result: LapType[];

        beforeAll(() => {
            result = classifyIntervalLapsType(speedLaps(speeds));
        });

        it('last lap is not COOLDOWN', () => {
            expect(result[result.length -1]).not.toBe(LapType.COOLDOWN);
        });

        it('last lap is WORKPUT', () => {
            expect(result[result.length -1]).toBe(LapType.REST);
        });
    });
});