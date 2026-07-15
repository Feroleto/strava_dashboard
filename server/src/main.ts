import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://localhost:5173' });
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
