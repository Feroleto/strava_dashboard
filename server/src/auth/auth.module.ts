import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthGuard } from './auth.guard';
import { AccountThrottlerGuard } from './account-throttler.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // env value is a jsonwebtoken-style duration string (e.g. "30d"); its
        // type (ms's StringValue) is too narrow to accept an arbitrary
        // config string, hence the cast
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '30d') as any },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [SessionService, AuthGuard, AccountThrottlerGuard, AuthService],
  exports: [SessionService, AuthGuard, AccountThrottlerGuard, AuthService],
})
export class AuthModule {}
