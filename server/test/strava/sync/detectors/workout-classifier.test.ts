import { describe, it, expect } from "vitest";
import { classifyWorkoutType } from "src/strava/sync/strava-sync.service";

describe('classifyWorkoutType', () => {
    // easy or long runs
    describe('EASY_OR_LONG', () => {
        it('returns EASY_OR_LONG when description is empty', () => {
            expect(classifyWorkoutType({ description: '' }))
            .toBe('EASY_OR_LONG');
        });

        it('returns EASY_OR_LONG when description is undefined', () => {
            expect(classifyWorkoutType({}))
            .toBe('EASY_OR_LONG');
        });

        it('returns EASY_OR_LONG when description says that is easy run', () => {
            expect(classifyWorkoutType({ description: 'Recovery Run'}))
            .toBe('EASY_OR_LONG');
        });

        it('returns EASY_OR_LONG when description says that is long run', () => {
            expect(classifyWorkoutType({ description: '25km Run'}))
            .toBe('EASY_OR_LONG');
        });
    });

    // hill repeats
    describe('HILL_REPEATS', () => {
        it('detect keyword "hill"', () => {
            expect(classifyWorkoutType({ description: 'Hill repeats'}))
            .toBe('HILL_REPEATS');
        });

        it('detect keyword "subida" (pt-br)', () => {
            expect(classifyWorkoutType({ description: 'treino em subida'}))
            .toBe('HILL_REPEATS');
        });

        it('detect keyword "elevação" (pt-br)', () => {
            expect(classifyWorkoutType({ description: 'treino de elevação'}))
            .toBe('HILL_REPEATS');
        });

        it('its case sensitive for "HILL"', () => {
            expect(classifyWorkoutType({ description: 'HILL sprints'}))
            .toBe('HILL_REPEATS');
        });

        it('its case sensitive for "SUBIDA"', () => {
            expect(classifyWorkoutType({ description: 'so SUBIDA'}))
            .toBe('HILL_REPEATS');
        });

        it('hill workout has priority over interval workout', () => {
            expect(classifyWorkoutType({ description: '10x200 hill repeats'}))
            .toBe('HILL_REPEATS');
        });
    });

    // intervals
    describe('INTERVAL', () => {
        it('detects keyword "tiro" (pt-br)', () => {
            expect(classifyWorkoutType({ description: "tiros de 200m"}))
            .toBe('INTERVAL');
        });

        it('detects keyword "interval"', () => {
            expect(classifyWorkoutType({ description: "200m intervals"}))
            .toBe('INTERVAL');
        });

        it('detects keyword "split"', () => {
            expect(classifyWorkoutType({ description: "400m splits"}))
            .toBe('INTERVAL');
        });

        it('detects NxM pattern', () => {
            expect(classifyWorkoutType({ description: "10x400"}))
            .toBe('INTERVAL');
        });

        it('detects N x M pattern', () => {
            expect(classifyWorkoutType({ description: "10 x 400"}))
            .toBe('INTERVAL');
        });

        it('detects NXM pattern', () => {
            expect(classifyWorkoutType({ description: "10X400"}))
            .toBe('INTERVAL');
        });

        it('detects N*M pattern', () => {
            expect(classifyWorkoutType({ description: "10*400"}))
            .toBe('INTERVAL');
        });

        it('detects time pattern Nx M\' - "5x3\'"', () => {
            expect(classifyWorkoutType({ description: "5x3'"}))
            .toBe('INTERVAL');
        });

        it('detects time pattern Nx MM:SS - "10 x 1:30"', () => {
            expect(classifyWorkoutType({ description: '10 x 1:30'}))
            .toBe('INTERVAL');
        });

        it('its case sensitive for "INTERVAL"', () => {
            expect(classifyWorkoutType({ description: 'INTERVAL RUN'}))
            .toBe('INTERVAL');
        });
    });

    describe('edge cases', () => {
        it('null-safe: description null is treated like empty', () => {
            expect(classifyWorkoutType({ description: null as any }))
            .toBe('EASY_OR_LONG');
        });
    });
});