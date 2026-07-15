import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5173');
  app.enableCors({ origin: frontendUrl });
  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
