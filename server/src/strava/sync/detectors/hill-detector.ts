import { ProcessedSecond } from '../strava-sync.service';
import { BaseDetector, DetectedLap, ProcessedDict } from './base-detector';

export class HillDetector extends BaseDetector {
  private readonly minElevationGain: number;
  private readonly minGrade: number;
  private readonly minWarmupDistM: number;

  constructor(
    minElevationGain    = 5.0,
    minGrade            = 2.0,
    minWarmupDistM      = 1000,
    minSpeedMoving      = 0.3,
    cooldownSpeedThreshold = 2.2,
  ) {
    super(minSpeedMoving, cooldownSpeedThreshold);
    this.minElevationGain = minElevationGain;
    this.minGrade         = minGrade;
    this.minWarmupDistM   = minWarmupDistM;
  }

  protected detectBlocks(dict: ProcessedDict): ProcessedSecond[][] {
    const times  = Array.from(dict.keys()).sort((a, b) => a - b);
    const blocks: ProcessedSecond[][] = [];
    let currentBlock: ProcessedSecond[] = [];
    let gapCounter = 0;
    const maxGap = 5;

    for (const t of times) {
      const data          = dict.get(t)!;
      const grade         = data.gradePercent ?? 0;
      const verticalSpeed = data.verticalSpeedMs ?? 0;

      const isUphill = grade > 1.0 || verticalSpeed > 0.05;

      if (isUphill) {
        currentBlock.push(data);
        gapCounter = 0;
      } else {
        if (currentBlock.length && gapCounter < maxGap) {
          currentBlock.push(data);
          gapCounter++;
        } else if (currentBlock.length) {
          const realBlock =
            gapCounter > 0 && gapCounter < currentBlock.length
              ? currentBlock.slice(0, -gapCounter)
              : currentBlock;

          if (this.isValidHill(realBlock)) {
            blocks.push(realBlock);
          }

          currentBlock = [];
          gapCounter   = 0;
        }
      }
    }

    if (currentBlock.length) {
      const realBlock =
        gapCounter > 0 && gapCounter < currentBlock.length
          ? currentBlock.slice(0, -gapCounter)
          : currentBlock;

      if (this.isValidHill(realBlock)) {
        blocks.push(realBlock);
      }
    }

    return blocks.filter(
      (b) => b[0].distanceTotalM >= this.minWarmupDistM,
    );
  }

  private isValidHill(block: ProcessedSecond[]): boolean {
    if (!block.length) return false;

    const elevGain =
      block[block.length - 1].elevationM - block[0].elevationM;
    const distance =
      block[block.length - 1].distanceTotalM - block[0].distanceTotalM;
    const avgGrade = distance > 0 ? (elevGain / distance) * 100 : 0;

    return elevGain >= this.minElevationGain && avgGrade >= this.minGrade;
  }

  protected summarizeEffort(
    block: ProcessedSecond[],
    label: string,
  ): DetectedLap {
    const summary     = this.summarizeCommon(block, label);
    const elevGain    = block[block.length - 1].elevationM - block[0].elevationM;
    const distance    = summary.distanceM;
    const movingSec   = summary.movingDurationSec;

    const avgGradePercent =
      distance > 0 ? (elevGain / distance) * 100 : 0;
    const vam =
      movingSec > 0 ? (elevGain / movingSec) * 3600 : 0;

    summary.elevGainM       = Math.round(elevGain * 10) / 10;
    summary.avgGradePercent = Math.round(avgGradePercent * 10) / 10;
    summary.vam             = Math.round(vam);

    return summary;
  }
}