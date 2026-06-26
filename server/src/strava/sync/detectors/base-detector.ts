import { ProcessedSecond } from '../strava-sync.service';

// Mirrors the dict structure that Python's BaseDetector._summarize_common returns.
// Used as input to map_laps_to_db_model (LapCreateInput in the TS sync service).
export interface DetectedLap {
  type: string;
  lapIndex: number | null;
  startSec: number;
  endSec: number;
  totalDurationSec: number;
  movingDurationSec: number;
  distanceM: number;
  avgPace: number;       // sec/km
  avgHr: number;
  elevGainM: number;
  avgGradePercent: number;
  vam: number;
}

// Indexed by secondIndex — mirrors Python's Dict[int, dict]
export type ProcessedDict = Map<number, ProcessedSecond>;

export abstract class BaseDetector {
  protected readonly minSpeedMoving: number;
  protected readonly cooldownSpeedThreshold: number;

  constructor(
    minSpeedMoving = 0.3,
    cooldownSpeedThreshold = 2.2,
  ) {
    this.minSpeedMoving = minSpeedMoving;
    this.cooldownSpeedThreshold = cooldownSpeedThreshold;
  }

  // ── Abstract interface ────────────────────────────────────────────────────

  protected abstract detectBlocks(dict: ProcessedDict): ProcessedSecond[][];

  protected abstract summarizeEffort(
    block: ProcessedSecond[],
    label: string,
  ): DetectedLap;

  // ── Common summariser (ports _summarize_common) ───────────────────────────

  protected summarizeCommon(
    block: ProcessedSecond[],
    typeLabel: string,
  ): DetectedLap {
    if (!block.length) {
      throw new Error('summarizeCommon called with empty block');
    }

    const startData = block[0];
    const endData   = block[block.length - 1];

    const distance = endData.distanceTotalM - startData.distanceTotalM;

    const movingSeconds = block.filter(
      (d) => (d.speedMs ?? 0) > this.minSpeedMoving,
    ).length;

    const avgSpeed = movingSeconds > 0 ? distance / movingSeconds : 0;
    const avgPace  = avgSpeed > 0.3 ? 1000 / avgSpeed : 0;

    const hrValues = block
      .map((d) => d.heartRate)
      .filter((hr) => hr != null && hr > 0);
    const avgHr =
      hrValues.length > 0
        ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length
        : 0;

    return {
      type:              typeLabel,
      lapIndex:          null,
      startSec:          startData.secondIndex,
      endSec:            endData.secondIndex,
      totalDurationSec:  endData.secondIndex - startData.secondIndex,
      movingDurationSec: movingSeconds,
      distanceM:         Math.round(distance * 10) / 10,
      avgPace,
      avgHr:             Math.round(avgHr * 10) / 10,
      elevGainM:         0,
      avgGradePercent:   0,
      vam:               0,
    };
  }

  // ── Split into 1 km blocks (ports _split_into_km) ────────────────────────

  protected splitIntoKm(
    block: ProcessedSecond[],
    labelPrefix: string,
  ): DetectedLap[] {
    if (!block.length) return [];

    const splits: DetectedLap[] = [];
    let currentSplit: ProcessedSecond[] = [];
    let startDistOffset = block[0].distanceTotalM;
    let splitCount = 1;

    for (const sec of block) {
      currentSplit.push(sec);
      const relativeDist = sec.distanceTotalM - startDistOffset;

      if (relativeDist >= 1000) {
        const summary = this.summarizeCommon(currentSplit, labelPrefix);
        summary.lapIndex = splitCount;
        splits.push(summary);
        currentSplit = [];
        startDistOffset = sec.distanceTotalM;
        splitCount++;
      }
    }

    if (currentSplit.length) {
      const summary = this.summarizeCommon(currentSplit, labelPrefix);
      summary.lapIndex = splitCount;
      splits.push(summary);
    }

    return splits;
  }

  // ── Cooldown boundary detection (ports _find_cooldown_start) ─────────────

  private findCooldownStart(
    dict: ProcessedDict,
    lastEnd: number,
    activityEnd: number,
    avgRestTime: number,
    avgRestDist: number,
  ): number {
    const startDist = dict.get(lastEnd)!.distanceTotalM;
    let cooldownTime = lastEnd + 1;

    for (let t = lastEnd + 1; t <= activityEnd; t++) {
      const data = dict.get(t);
      if (!data) continue;

      const restDuration = t - lastEnd;
      const restDist     = data.distanceTotalM - startDist;

      const distExceeded =
        avgRestDist > 0 && restDist > avgRestDist * 1.1;
      const timeExceeded =
        restDuration > avgRestTime &&
        (data.speedMs ?? 0) >= this.cooldownSpeedThreshold;

      if (distExceeded || timeExceeded) break;
      cooldownTime = t + 1;
    }

    return cooldownTime;
  }

  // ── Main entry point (ports analyze) ─────────────────────────────────────

  analyze(dict: ProcessedDict): DetectedLap[] {
    const effortBlocks = this.detectBlocks(dict);
    const times        = Array.from(dict.keys()).sort((a, b) => a - b);

    if (!effortBlocks.length) {
      // no structure found → split whole activity into 1 km blocks
      return this.splitIntoKm(
        times.map((t) => dict.get(t)!),
        'ACTIVITY',
      );
    }

    const fullLaps: DetectedLap[] = [];

    // ── WARMUP ────────────────────────────────────────────────────────────
    const warmupEndTime = effortBlocks[0][0].secondIndex;
    if (warmupEndTime > times[0]) {
      const warmupData = times
        .filter((t) => t < warmupEndTime)
        .map((t) => dict.get(t)!);
      fullLaps.push(...this.splitIntoKm(warmupData, 'WARMUP'));
    }

    // ── WORKOUTs and RESTs ───────────────────────────────────────────────
    const restDurations: number[] = [];
    const restDistances: number[] = [];

    for (let i = 0; i < effortBlocks.length; i++) {
      const currentBlock = effortBlocks[i];
      const summary      = this.summarizeEffort(currentBlock, 'WORKOUT');
      summary.lapIndex   = i + 1;
      fullLaps.push(summary);

      // rest between consecutive effort blocks
      if (i < effortBlocks.length - 1) {
        const restStart = currentBlock[currentBlock.length - 1].secondIndex + 1;
        const restEnd   = effortBlocks[i + 1][0].secondIndex;
        const restData  = times
          .filter((t) => t >= restStart && t <= restEnd)
          .map((t) => dict.get(t)!);

        if (restData.length) {
          const lap      = this.summarizeCommon(restData, 'REST');
          lap.lapIndex   = i + 1;
          fullLaps.push(lap);
          restDurations.push(restEnd - restStart);
          restDistances.push(lap.distanceM);
        }
      }
    }

    const avgRestTime =
      restDurations.length > 0
        ? restDurations.reduce((a, b) => a + b, 0) / restDurations.length
        : 60;
    const avgRestDist =
      restDistances.length > 0
        ? restDistances.reduce((a, b) => a + b, 0) / restDistances.length
        : 0;

    // ── last REST before COOLDOWN ─────────────────────────────────────────
    const lastBlock   = effortBlocks[effortBlocks.length - 1];
    const lastEnd     = lastBlock[lastBlock.length - 1].secondIndex;
    const activityEnd = times[times.length - 1];

    const cooldownStart = this.findCooldownStart(
      dict,
      lastEnd,
      activityEnd,
      avgRestTime,
      avgRestDist,
    );

    if (cooldownStart > lastEnd + 1) {
      const restFinalData = times
        .filter((t) => t > lastEnd && t < cooldownStart)
        .map((t) => dict.get(t)!);
      if (restFinalData.length) {
        const lap    = this.summarizeCommon(restFinalData, 'REST');
        lap.lapIndex = effortBlocks.length;
        fullLaps.push(lap);
      }
    }

    // ── COOLDOWN ─────────────────────────────────────────────────────────
    if (cooldownStart < activityEnd) {
      const cooldownData = times
        .filter((t) => t >= cooldownStart)
        .map((t) => dict.get(t)!);
      fullLaps.push(...this.splitIntoKm(cooldownData, 'COOLDOWN'));
    }

    return fullLaps;
  }
}