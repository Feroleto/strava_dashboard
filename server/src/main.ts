import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';
  // 1 hop: Vercel's external rewrite (client/vercel.json) overwrites
  // X-Forwarded-For with the real client IP before proxying to Render, which
  // only appends its own hop on top — trusting exactly 1 hop here extracts
  // that real IP for rate limiting. `true` would be worse: it'd trust the
  // leftmost XFF entry with zero hops required, spoofable by anyone hitting
  // the Render domain directly (see CLAUDE.md "trust proxy" for the accepted
  // residual risk of that direct-access path). No proxy at all in dev.
  app.set('trust proxy', isProd ? 1 : false);
  const frontendUrl = config.get<string>(
    'FRONTEND_URL',
    'http://localhost:5173',
  );
  app.use(cookieParser());
  app.enableCors({ origin: frontendUrl, credentials: true });
  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
