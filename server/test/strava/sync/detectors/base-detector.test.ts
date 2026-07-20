import { describe, it, expect } from 'vitest';
import { IntervalDetector } from 'src/strava/sync/detectors/interval-detector';
import { ProcessedDict } from 'src/strava/sync/detectors/base-detector';
import { ProcessedSecond } from 'src/strava/sync/types';

function makeSecond(overrides: Partial<ProcessedSecond>): ProcessedSecond {
  return {
    secondIndex: 0,
    distanceTotalM: 0,
    distanceDeltaM: 0,
    speedRaw: 0,
    speedMs: 0,
    accelerationMs2: 0,
    heartRate: 150,
    elevationM: 100,
    elevationSmooth: 100,
    elevationDelta: 0,
    gradePercent: 0,
    verticalSpeedMs: 0,
    paceSeckm: null,
    cadence: null,
    ...overrides,
  };
}

describe('BaseDetector summarizeCommon', () => {
  it('allows negative elevGainM for a downhill WARMUP block', () => {
    const dict: ProcessedDict = new Map();
    let dist = 0;

    // warmup: 20s below the effort speed threshold, descending 19m
    for (let t = 0; t < 20; t++) {
      dist += 2.0;
      dict.set(
        t,
        makeSecond({ secondIndex: t, distanceTotalM: dist, speedMs: 2.0, elevationM: 100 - (t + 1) }),
      );
    }

    // effort block: 50s above the threshold, flat elevation, distance >= minBlockDist
    for (let t = 20; t < 70; t++) {
      dist += 4.0;
      dict.set(
        t,
        makeSecond({ secondIndex: t, distanceTotalM: dist, speedMs: 4.0, elevationM: 80 }),
      );
    }

    const laps = new IntervalDetector().analyze(dict);
    const warmup = laps.find((l) => l.type === 'WARMUP');

    expect(warmup).toBeDefined();
    expect(warmup!.elevGainM).toBe(-19);
  });
});
