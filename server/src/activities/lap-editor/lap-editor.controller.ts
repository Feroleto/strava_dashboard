import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { AccountThrottlerGuard } from '../../auth/account-throttler.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/current-user.decorator';
import { ActivityStreamsService, StreamUnavailableError } from './activity-streams.service';
import { LapEditorService } from './lap-editor.service';
import { parseLapEditInputs } from './dto';

@Controller('activities/:id')
@UseGuards(AuthGuard)
export class LapEditorController {
  constructor(
    private readonly streamsService: ActivityStreamsService,
    private readonly editorService: LapEditorService,
  ) {}

  @UseGuards(AccountThrottlerGuard)
  @Get('streams')
  async getStreams(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    let result;
    try {
      result = await this.streamsService.getStream(user.id, id);
    } catch (err) {
      if (err instanceof StreamUnavailableError) {
        throw new UnprocessableEntityException('STREAM_UNAVAILABLE');
      }
      throw err;
    }

    if (!result) {
      throw new NotFoundException(`Activity ${id} not found`);
    }

    return {
      points: result.points.map((p) => ({
        secondIndex: p.secondIndex,
        distanceTotalM: p.distanceTotalM,
        elevationM: p.elevationM,
        heartRate: p.heartRate,
        speedMs: p.speedMs,
        cadence: p.cadence,
      })),
      source: result.source,
    };
  }

  @UseGuards(AccountThrottlerGuard)
  @Put('laps')
  async saveLaps(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { laps?: unknown },
  ) {
    const laps = parseLapEditInputs(body);
    return this.editorService.saveLaps(user.id, id, laps);
  }
}
