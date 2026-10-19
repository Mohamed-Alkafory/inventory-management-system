import { Test, TestingModule } from '@nestjs/testing';
import {
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

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
