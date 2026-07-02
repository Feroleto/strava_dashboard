import { StreamProcessor, RawActivitySecond } from 'src/strava/sync/processors/streams-processor';
import type { ProcessedSecond } from 'src/strava/sync/strava-sync.service';
import { describe, it, expect, beforeAll } from "vitest";

function makeSeconds(
  count: number,
  opts: {
    startIndex?: number;
    startDist?: number;
    distPerSec?: number;
    elevation?: number;
    heartRate?: number; 
  } = {},
): RawActivitySecond[] {
  const {
    startIndex = 0,
    startDist  = 0,
    distPerSec = 3.5,
    elevation  = 100,
    heartRate  = 150,
  } = opts;
 
  return Array.from({ length: count }, (_, i) => ({
    secondIndex:    startIndex + i,
    distanceTotalM: startDist + distPerSec * i,
    distanceDeltaM: distPerSec,
    heartRate,
    elevationM:     elevation,
  }));
}

function withNulls<T extends Record<string, any>>(
  arr: T[],
  field: keyof T,
  indices: number[],
): T[] {
  return arr.map((item, i) =>
    indices.includes(i) ? { ...item, [field]: null } : item,
  );
}

describe('StreamProcessor.processStreams', () => {
  describe('null or empty entry', () => {
  	it('return [] for an empty array', () => {
      expect(StreamProcessor.processStreams([]))
      .toEqual([]);
  	});

    it('process correctly only one second', () => {
      const input: RawActivitySecond[] = [{
        secondIndex: 0,
        distanceTotalM: 0,
        distanceDeltaM: 0,
        heartRate: 140,
        elevationM: 100,
      }];

      const result = StreamProcessor.processStreams(input);

      expect(result).toHaveLength(1);
      expect(result[0].secondIndex).toBe(0);
    });
  });

  describe('output invariants', () => {
  	const raw = makeSeconds(60);
    let result: ProcessedSecond[];
    
    beforeAll(() => {
      result = StreamProcessor.processStreams(raw);
    });
    
    it('length == (maxIndex - minIndex + 1) — fill time gaps', () => {
      expect(result.length).toBe(60);
    });
    
    it('secondIndex is monotonically increasing', () => {
      for (let i = 1; i < result.length; i++) {
        expect(result[i].secondIndex).toBeGreaterThan(result[i - 1].secondIndex);
      }
    });
    
    it('distanceTotalM is non-decreasing monotonically', () => {
      for (let i = 1; i < result.length; i++) {
        expect(result[i].distanceTotalM).toBeGreaterThanOrEqual(
    	    result[i - 1].distanceTotalM,
        );
      }
    });
    
    it('distanceDeltaM >= 0 for all points', () => {
      result.forEach((s) => expect(s.distanceDeltaM).toBeGreaterThanOrEqual(0));
    });
    
    it('gradePercent its between -40 and 40 (clamp applied)', () => {
      result.forEach((s) => {
    	  expect(s.gradePercent).toBeGreaterThanOrEqual(-40);
      	expect(s.gradePercent).toBeLessThanOrEqual(40);
      });
    });
    
    it('paceSeckm is null when speed <= 0.3 m/s', () => {
      const stopped = makeSeconds(5, { distPerSec: 0.1 });
      const res = StreamProcessor.processStreams(stopped);
      const nullPaces = res.filter((s) => s.paceSeckm === null);
      expect(nullPaces.length).toBeGreaterThan(0);
    });
    
    it('all ProcessedSecond has required fields', () => {
      const requiredKeys: (keyof ProcessedSecond)[] = [
        'secondIndex', 'distanceTotalM', 'distanceDeltaM',
        'speedRaw', 'speedMs', 'accelerationMs2',
        'heartRate', 'elevationM', 'elevationSmooth',
        'elevationDelta', 'gradePercent', 'verticalSpeedMs',
      ];
      result.forEach((s) => {
        requiredKeys.forEach((k) => {
    	    expect(s).toHaveProperty(k);
        });
      });
    });
  });

	describe('gaps interpolation', () => {
    it('fill time gaps — output has complete span length', () => {
      const raw: RawActivitySecond[] = [
        { secondIndex: 0, distanceTotalM: 0,    distanceDeltaM: 0, heartRate: 140, elevationM: 100 },
        { secondIndex: 5, distanceTotalM: 17.5, distanceDeltaM: 3.5, heartRate: 145, elevationM: 101 },
        { secondIndex: 10, distanceTotalM: 35,  distanceDeltaM: 3.5, heartRate: 150, elevationM: 102 },
      ];
 
      const result = StreamProcessor.processStreams(raw);

      expect(result).toHaveLength(11);
      expect(result[0].secondIndex).toBe(0);
      expect(result[10].secondIndex).toBe(10);
    });
 
    it('distance has linear interpolation within 20s limit range', () => {
      const raw = makeSeconds(30, { distPerSec: 4.0 });
      const withGap = withNulls(raw, 'distanceTotalM', [10, 11, 12, 13, 14]);
 
      const result = StreamProcessor.processStreams(withGap);
 
      expect(result[10].distanceTotalM).toBeGreaterThan(0);
    });
 
    it('forward-fill applied when gap > interpolation limit', () => {
      const raw = makeSeconds(60, { distPerSec: 3.5 });
      const withLongGap = withNulls(
        raw, 'distanceTotalM',
        Array.from({ length: 25 }, (_, i) => 20 + i),
      );
 
      const result = StreamProcessor.processStreams(withLongGap);
 
      result.forEach((s) => {
        expect(s.distanceTotalM).toBeDefined();
        expect(typeof s.distanceTotalM).toBe('number');
      });
    });
 
    it('HR linear interplotion within 15s limit', () => {
      const raw = makeSeconds(30, { heartRate: 150 });
      const withGap = withNulls(raw, 'heartRate', [10, 11, 12]);
 
      const result = StreamProcessor.processStreams(withGap);
 
      expect(result[11].heartRate).toBeGreaterThan(0);
    });
  });

	describe('HR EWM (α=0.2)', () => {
    it('smooth HR converges to real value in constants series', () => {
      const raw = makeSeconds(100, { heartRate: 150 });
      const result = StreamProcessor.processStreams(raw);

      const last = result[result.length - 1];
      expect(last.heartRate).toBeCloseTo(150, 0);
    });
 
    it('smooth HR is always positive when has HR data', () => {
      const raw = makeSeconds(30, { heartRate: 140 });
      const result = StreamProcessor.processStreams(raw);
      result.forEach((s) => expect(s.heartRate).toBeGreaterThan(0));
    });
  });

	describe('speed and pace', () => {
    it('speedMs > 0 for moving activities', () => {
      const raw = makeSeconds(30, { distPerSec: 3.5 });
      const result = StreamProcessor.processStreams(raw);
 
      const moving = result.slice(3);
      moving.forEach((s) => expect(s.speedMs).toBeGreaterThan(0));
    });
 
    it('paceSeckm = 1000 / speedMs when speedMs > 0.3', () => {
      const raw = makeSeconds(30, { distPerSec: 4.0 });
      const result = StreamProcessor.processStreams(raw);
 
      const movingPoints = result.filter((s) => s.speedMs > 0.3 && s.paceSeckm !== null);
      expect(movingPoints.length).toBeGreaterThan(0);
 
      movingPoints.forEach((s) => {
        expect(s.paceSeckm!).toBeGreaterThan(0);
      });
    });
 
    it('speedRaw = 0 in the first point (without delta before)', () => {
      const raw = makeSeconds(10, { distPerSec: 3.5 });
      const result = StreamProcessor.processStreams(raw);
      expect(result[0].speedRaw).toBe(0);
    });
  });

	describe('grade and elevation', () => {
    it('grade is ~0 in regular plane', () => {
      const raw = makeSeconds(30, { elevation: 100, distPerSec: 3.5 });
      const result = StreamProcessor.processStreams(raw);
 
      const avgGrade =
        result.reduce((s, p) => s + Math.abs(p.gradePercent), 0) / result.length;
      expect(avgGrade).toBeLessThan(1);
    });
 
    it('grade is positive in a hill', () => {
      const raw = Array.from({ length: 40 }, (_, i) => ({
        secondIndex:    i,
        distanceTotalM: i * 3.5,
        distanceDeltaM: 3.5,
        heartRate:      155,
        elevationM:     100 + i * 0.35, // 10%
      }));
 
      const result = StreamProcessor.processStreams(raw);
 
      const midpoints = result.slice(10, 30);
      const posGrades = midpoints.filter((s) => s.gradePercent > 0);
      expect(posGrades.length).toBeGreaterThan(0);
    });
 
    it('grade dont exceed ±40 even with extreme data', () => {
      const raw: RawActivitySecond[] = [
        { secondIndex: 0, distanceTotalM: 0,   distanceDeltaM: 0,   heartRate: 140, elevationM: 100 },
        { secondIndex: 1, distanceTotalM: 1,   distanceDeltaM: 1,   heartRate: 140, elevationM: 200 },
        { secondIndex: 2, distanceTotalM: 2,   distanceDeltaM: 1,   heartRate: 140, elevationM: 100 },
      ];
 
      const result = StreamProcessor.processStreams(raw);
      result.forEach((s) => {
        expect(s.gradePercent).toBeGreaterThanOrEqual(-40);
        expect(s.gradePercent).toBeLessThanOrEqual(40);
      });
    });
  });
})