import { ProcessedSecond } from '../types';
import { BaseDetector, DetectedLap, ProcessedDict } from './base-detector';

export class IntervalDetector extends BaseDetector {
  private readonly minSpeed: number;
  private readonly maxBreakAllowed: number;
  private readonly minBlockDist: number;

  constructor(
    minSpeed        = 3.3,
    maxBreakAllowed = 10,
    minBlockDist    = 150,
    minSpeedMoving  = 0.3,
    cooldownSpeedThreshold = 2.2,
  ) {
    super(minSpeedMoving, cooldownSpeedThreshold);
    this.minSpeed        = minSpeed;
    this.maxBreakAllowed = maxBreakAllowed;
    this.minBlockDist    = minBlockDist;
  }

  protected detectBlocks(dict: ProcessedDict): ProcessedSecond[][] {
    const times = Array.from(dict.keys()).sort((a, b) => a - b);
    const blocks: ProcessedSecond[][] = [];
    let currentBlock: ProcessedSecond[] = [];
    let gapCounter = 0;

    for (const t of times) {
      const data  = dict.get(t)!;
      const speed = data.speedMs ?? 0;

      if (speed >= this.minSpeed) {
        currentBlock.push(data);
        gapCounter = 0;
      } else {
        if (currentBlock.length && gapCounter < this.maxBreakAllowed) {
          currentBlock.push(data);
          gapCounter++;
        } else if (currentBlock.length) {
          const realBlock =
            gapCounter > 0 && gapCounter < currentBlock.length
              ? currentBlock.slice(0, -gapCounter)
              : currentBlock;

          if (this.isValidBlock(realBlock)) {
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

      if (this.isValidBlock(realBlock)) {
        blocks.push(realBlock);
      }
    }

    return blocks;
  }

  private isValidBlock(block: ProcessedSecond[]): boolean {
    if (!block.length) return false;
    const dist =
      block[block.length - 1].distanceTotalM - block[0].distanceTotalM;
    return dist >= this.minBlockDist;
  }

  protected summarizeEffort(
    block: ProcessedSecond[],
    label: string,
  ): DetectedLap {
    const summary = this.summarizeCommon(block, label);

    const elevGain = block[block.length - 1].elevationM - block[0].elevationM;

    summary.elevGainM       = Math.round(elevGain * 10) / 10;
    summary.avgGradePercent = 0;
    summary.vam             = 0;

    return summary;
  }
}