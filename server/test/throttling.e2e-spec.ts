import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // POST /auth/logout is @Throttle({ default: { limit: 10, ttl: 60_000 } })
  // and has no external dependencies (just clears a cookie), so it's the
  // cheapest way to exercise the ThrottlerGuard end-to-end
  it('responds 429 after exceeding the per-route limit', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < 10; i++) {
      await request(server).post('/auth/logout').expect(204);
    }

    await request(server).post('/auth/logout').expect(429);
  });
});
