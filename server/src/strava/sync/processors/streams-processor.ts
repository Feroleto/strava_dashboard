import { ProcessedSecond } from '../strava-sync.service';

export interface RawActivitySecond {
  secondIndex: number;
  distanceTotalM: number | null;
  distanceDeltaM: number | null;
  heartRate: number | null;
  elevationM: number | null;
}

export class StreamProcessor {
  static processStreams(raw: RawActivitySecond[]): ProcessedSecond[] {
    if (!raw || raw.length === 0) {
      return [];
    }

    // streams full range
    const minT = raw[0].secondIndex;
    const maxT = raw[raw.length - 1].secondIndex;
    const len = maxT - minT + 1;

    const rawMap = new Map<number, RawActivitySecond>();
    for (const r of raw) rawMap.set(r.secondIndex, r);

    // arrays to keep the state for all seconds
    const points = Array.from({ length: len }, (_, i) => {
      const t = minT + i;
      const r = rawMap.get(t);
      return {
        t,
        distRaw: r?.distanceTotalM ?? null,
        elevRaw: r?.elevationM ?? null,
        hrRaw: r?.heartRate ?? null,
        
        distPrev: null as number | null, distPrevT: null as number | null,
        distNext: null as number | null, distNextT: null as number | null,
        elevPrev: null as number | null, elevPrevT: null as number | null,
        elevNext: null as number | null, elevNextT: null as number | null,
        hrPrev: null as number | null, hrPrevT: null as number | null,
        hrNext: null as number | null, hrNextT: null as number | null,
        
        distInterp: 0, elevInterp: 0, hrInterp: 0,
        speedRaw: 0, speedMs: 0, accel: 0, hrEwm: 0,
        elevSmooth: 0, elevDelta: 0, distDelta: 0,
      };
    });

    // forward filling
    let lDist: number | null = null, lDistT: number | null = null, lElev: number | null = null, lElevT: number | null = null, lHr: number | null = null, lHrT: number | null = null;
    for (let i = 0; i < len; i++) {
      const p = points[i];
      if (p.distRaw !== null) { lDist = p.distRaw; lDistT = p.t; }
      if (p.elevRaw !== null) { lElev = p.elevRaw; lElevT = p.t; }
      if (p.hrRaw !== null)   { lHr = p.hrRaw; lHrT = p.t; }
      
      p.distPrev = lDist; p.distPrevT = lDistT;
      p.elevPrev = lElev; p.elevPrevT = lElevT;
      p.hrPrev = lHr;     p.hrPrevT = lHrT;
    }

    // backward filling
    let nDist: number | null = null, nDistT: number | null = null, nElev: number | null = null, nElevT: number | null = null, nHr: number | null = null, nHrT: number | null = null;
    for (let i = len - 1; i >= 0; i--) {
      const p = points[i];
      if (p.distRaw !== null) { nDist = p.distRaw; nDistT = p.t; }
      if (p.elevRaw !== null) { nElev = p.elevRaw; nElevT = p.t; }
      if (p.hrRaw !== null)   { nHr = p.hrRaw; nHrT = p.t; }
      
      p.distNext = nDist; p.distNextT = nDistT;
      p.elevNext = nElev; p.elevNextT = nElevT;
      p.hrNext = nHr;     p.hrNextT = nHrT;
    }

    // linear interpolation
    for (let i = 0; i < len; i++) {
      const p = points[i];

      // distance (20s limit)
      if (p.distRaw !== null) {
        p.distInterp = p.distRaw;
      } else if (p.distNext !== null && p.distPrev !== null && p.distNextT !== null && p.distPrevT !== null && (p.distNextT - p.distPrevT) <= 20) {
        p.distInterp = p.distPrev + (p.distNext - p.distPrev) * (p.t - p.distPrevT) / (p.distNextT - p.distPrevT || 1);
      } else {
        p.distInterp = p.distPrev ?? 0;
      }

      // elevation (10s limit)
      if (p.elevRaw !== null) {
        p.elevInterp = p.elevRaw;
      } else if (p.elevNext !== null && p.elevPrev !== null && p.elevNextT !== null && p.elevPrevT !== null && (p.elevNextT - p.elevPrevT) <= 10) {
        p.elevInterp = p.elevPrev + (p.elevNext - p.elevPrev) * (p.t - p.elevPrevT) / (p.elevNextT - p.elevPrevT || 1);
      } else {
        p.elevInterp = p.elevPrev ?? 0;
      }

      // HR (15s limit)
      if (p.hrRaw !== null) {
        p.hrInterp = p.hrRaw;
      } else if (p.hrNext !== null && p.hrPrev !== null && p.hrNextT !== null && p.hrPrevT !== null && (p.hrNextT - p.hrPrevT) <= 15) {
        p.hrInterp = p.hrPrev + (p.hrNext - p.hrPrev) * (p.t - p.hrPrevT) / (p.hrNextT - p.hrPrevT || 1);
      } else {
        p.hrInterp = p.hrPrev ?? 0;
      }
    }

    // Speed Raw (Diff)
    for (let i = 0; i < len; i++) {
      points[i].speedRaw = i === 0 ? 0.0 : Math.max(0, points[i].distInterp - points[i - 1].distInterp);
    }

    // Speed Ms (rolling average)
    for (let i = 0; i < len; i++) {
      points[i].speedMs = this.rollingAvg(points, i, 2, 2, 'speedRaw');
    }

    // Acceleration (Diff de Speed Ms)
    for (let i = 0; i < len; i++) {
      points[i].accel = i === 0 ? 0.0 : points[i].speedMs - points[i - 1].speedMs;
    }

    // HR EWMA (smooth heart rate, Alpha = 0.2)
    if (len > 0) points[0].hrEwm = points[0].hrInterp;
    for (let i = 1; i < len; i++) {
      points[i].hrEwm = 0.2 * points[i].hrInterp + 0.8 * points[i - 1].hrEwm;
    }

    // Elevation Smooth (7 points rolling average)
    for (let i = 0; i < len; i++) {
      points[i].elevSmooth = this.rollingAvg(points, i, 3, 3, 'elevInterp');
    }

    // Elevation Delta and Distance Delta
    for (let i = 0; i < len; i++) {
      points[i].elevDelta = i === 0 ? 0.0 : points[i].elevSmooth - points[i - 1].elevSmooth;
      points[i].distDelta = Math.max(0.0, i === 0 ? 0.0 : points[i].distInterp - points[i - 1].distInterp);
    }

    // Grade, Vertical Speed and Pace
    const processed: ProcessedSecond[] = new Array(len);
    for (let i = 0; i < len; i++) {
      const p = points[i];
      
      // Grade Percent (Clamped between -40 and 40)
      let grade = p.distDelta > 0 ? (p.elevDelta / p.distDelta) * 100.0 : 0.0;
      grade = Math.max(-40.0, Math.min(40.0, grade));

      // Vertical Speed (5 points rollign average - elevDelta)
      const vSpeed = this.rollingAvg(points, i, 2, 2, 'elevDelta');

      // Pace (seconds/km)
      const pace = p.speedMs > 0.3 ? 1000.0 / p.speedMs : null;

      processed[i] = {
        secondIndex: p.t,
        distanceTotalM: p.distInterp,
        distanceDeltaM: p.distDelta,
        speedRaw: p.speedRaw,
        speedMs: p.speedMs,
        accelerationMs2: p.accel,
        heartRate: p.hrEwm,
        elevationM: p.elevInterp,
        elevationSmooth: p.elevSmooth,
        elevationDelta: p.elevDelta,
        gradePercent: grade,
        verticalSpeedMs: vSpeed,
        paceSeckm: pace,
      };
    }

    return processed;
  }

  private static rollingAvg(data: any[], index: number, pre: number, post: number, key: string): number {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, index - pre);
    const end = Math.min(data.length - 1, index + post);
    
    for (let i = start; i <= end; i++) {
      sum += data[i][key];
      count++;
    }
    return count > 0 ? sum / count : 0.0;
  }
}