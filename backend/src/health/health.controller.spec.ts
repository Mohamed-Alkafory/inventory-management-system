import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

/** `SkipThrottle()` with no arguments sets this metadata key to `true`. */
const THROTTLER_SKIP_DEFAULT = 'THROTTLER:SKIPdefault';

describe('HealthController', () => {
  let controller: HealthController;

  const prismaMock = {
    $queryRaw: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health/live', () => {
    it('returns ok without touching the database', () => {
      expect(controller.live()).toEqual({ status: 'ok' });
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('is public so probes do not need a token', () => {
      expect(
        Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.live),
      ).toBe(true);
    });

    it('is excluded from throttling', () => {
      expect(
        Reflect.getMetadata(
          THROTTLER_SKIP_DEFAULT,
          HealthController.prototype.live,
        ),
      ).toBe(true);
    });
  });

  describe('GET /health', () => {
    it('returns db up when the database query succeeds', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(controller.checkHealth()).resolves.toEqual({
        status: 'ok',
        db: 'up',
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('rejects with 503 when the database query fails', async () => {
      prismaMock.$queryRaw.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.checkHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
