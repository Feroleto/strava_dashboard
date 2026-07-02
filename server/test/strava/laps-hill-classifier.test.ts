import {
  classifyHillLapsType,
} from 'src/strava/sync/detectors/lap-classifier';
import { LapType } from '@prisma/client';
import { describe, it, expect, beforeAll } from "vitest";

function vamLaps(vams: number[]) {
  return vams.map((v) => ({ vam: v }));
}

describe('classifyHillLapsType', () => {

    describe('degenerated cases', () => {
        it('returns [RUN] for list with only one lap', () => {
            expect(classifyHillLapsType(vamLaps([500])))
            .toEqual([LapType.RUN]);
        });

        it('returns all RUN laps when σ < 50 - elevation is uniform', () => {
            const laps = vamLaps([300, 310, 295, 305, 300]);
            const result = classifyHillLapsType(laps);
            expect(result.every((t) => t === LapType.RUN))
            .toBe(true);
        });
    });

    describe('normal hill repeats workout: warmup - hill repeats - cooldown', () => {
        const vams = [50, 800, 20, 820, 15, 780, 20, 40];
        let result: LapType[];

        beforeAll(() => {
            result = classifyHillLapsType(vamLaps(vams));
        });

        it('has correct length', () => {
            expect(result)
            .toHaveLength(vams.length);
        });

        it('first lap is WARMUP', () => {
            expect(result[0])
            .toBe(LapType.WARMUP);
        });

        it('last lap is COOLDOWN', () => {
            expect(result[result.length - 1])
            .toBe(LapType.COOLDOWN);
        });

        it('high vam laps are WORKOUT', () => {
            [1, 3, 5].forEach((i) => {
                expect(result[i])
                .toBe(LapType.WORKOUT);
            });
        });

        it('low vam laps after WORKOUT laps are REST', () => {
            [2, 4, 6].forEach((i) => {
                expect(result[i])
                .toBe(LapType.REST);
            });
        });
    });

    describe('training without warmup and cooldown laps', () => {
        const vams = [800, 20, 820, 15, 780, 20];
        let result: LapType[];

        beforeAll(() => {
            result = classifyHillLapsType(vamLaps(vams));
        });

        it('first lap is WORKOUT', () => {
            expect(result[0])
            .toBe(LapType.WORKOUT);
        });

        it('last lap is REST', () => {
            expect(result[result.length - 1])
            .toBe(LapType.REST);
        });
    });
})