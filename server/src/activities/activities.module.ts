import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { StravaModule } from '../strava/strava.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivityStreamsService } from './lap-editor/activity-streams.service';
import { LapEditorService } from './lap-editor/lap-editor.service';
import { LapEditorController } from './lap-editor/lap-editor.controller';

@Module({
  imports: [ConfigModule, AuthModule, StravaModule],
  controllers: [ActivitiesController, LapEditorController],
  providers: [ActivitiesService, ActivityStreamsService, LapEditorService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}