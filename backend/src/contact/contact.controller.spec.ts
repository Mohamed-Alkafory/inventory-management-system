import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import {
  ContactController,
  CONTACT_THROTTLE_LIMIT,
  CONTACT_THROTTLE_TTL_MS,
} from './contact.controller.js';
import { ContactMessagesController } from './contact-messages.controller.js';
import { ContactService } from './contact.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';
import { ContactStatus } from '../generated/prisma/enums.js';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';

const MESSAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACTOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// @nestjs/throttler stores decorator metadata under these internal keys.
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMITdefault';
const THROTTLER_TTL_KEY = 'THROTTLER:TTLdefault';

const validBody = (overrides: Record<string, unknown> = {}) => ({
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Help',
  message: 'Please help me',
  ...overrides,
});

describe('ContactController', () => {
  let controller: ContactController;
  let reflector: Reflector;
  const create = vi.fn();

  beforeEach(async () => {
    create.mockReset().mockResolvedValue({ received: true });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [{ provide: ContactService, useValue: { create } }],
    }).compile();

    controller = module.get<ContactController>(ContactController);
    reflector = module.get(Reflector);
  });

  it('forwards the submission and returns the minimal acknowledgement', async () => {
    const dto = validBody() as unknown as CreateContactMessageDto;
    await expect(controller.create(dto)).resolves.toEqual({ received: true });
    expect(create).toHaveBeenCalledWith(dto);
  });

  it('is public and carries the 5-per-hour throttle metadata', () => {
    const handler = ContactController.prototype.create;

    expect(reflector.get<boolean>(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata(THROTTLER_LIMIT_KEY, handler)).toBe(
      CONTACT_THROTTLE_LIMIT,
    );
    expect(Reflect.getMetadata(THROTTLER_TTL_KEY, handler)).toBe(
      CONTACT_THROTTLE_TTL_MS,
    );
    expect(CONTACT_THROTTLE_LIMIT).toBe(5);
    expect(CONTACT_THROTTLE_TTL_MS).toBe(3_600_000);
  });

  describe('body validation', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const validate = (value: unknown) =>
      pipe.transform(value, {
        type: 'body',
        metatype: CreateContactMessageDto,
      });

    it('accepts the documented maximum lengths', async () => {
      await expect(
        validate(
          validBody({
            name: 'n'.repeat(100),
            email: 'jane@example.com',
            subject: 's'.repeat(200),
            message: 'm'.repeat(5000),
            honeypot: '',
          }),
        ),
      ).resolves.toMatchObject({
        name: 'n'.repeat(100),
        subject: 's'.repeat(200),
        message: 'm'.repeat(5000),
      });
    });

    it('trims every text field before storing it', async () => {
      await expect(
        validate({
          name: '  Jane Doe  ',
          email: '  jane@example.com ',
          subject: '  Help  ',
          message: '  Please help me  ',
          honeypot: '   ',
        }),
      ).resolves.toMatchObject({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Help',
        message: 'Please help me',
        honeypot: '',
      });
    });

    it.each([
      ['name over 100', { name: 'n'.repeat(101) }],
      ['blank name', { name: '   ' }],
      ['invalid email', { email: 'not-an-email' }],
      ['email over 255', { email: `${'a'.repeat(250)}@example.com` }],
      ['subject over 200', { subject: 's'.repeat(201) }],
      ['message over 5000', { message: 'm'.repeat(5001) }],
      ['missing message', { message: undefined }],
      ['unknown field', { assignedToId: ACTOR_ID }],
    ])('rejects %s with 400', async (_label, override) => {
      await expect(validate(validBody(override))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});

describe('ContactMessagesController', () => {
  let reflector: Reflector;

  const findAll = vi.fn();
  const findOne = vi.fn();
  const update = vi.fn();

  beforeEach(async () => {
    findAll.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    findOne.mockReset().mockResolvedValue({ id: MESSAGE_ID });
    update.mockReset().mockResolvedValue({ id: MESSAGE_ID });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactMessagesController],
      providers: [
        { provide: ContactService, useValue: { findAll, findOne, update } },
      ],
    }).compile();

    reflector = module.get(Reflector);
  });

  it('forwards inbox calls to the service', async () => {
    const controller = new ContactMessagesController({
      findAll,
      findOne,
      update,
    } as unknown as ContactService);

    await controller.findAll({} as never);
    await controller.findOne(MESSAGE_ID);
    await controller.update(
      MESSAGE_ID,
      { status: ContactStatus.RESOLVED },
      { sub: ACTOR_ID, role: 'SUPPORT' },
    );

    expect(findAll).toHaveBeenCalledWith({});
    expect(findOne).toHaveBeenCalledWith(MESSAGE_ID);
    expect(update).toHaveBeenCalledWith(
      MESSAGE_ID,
      { status: ContactStatus.RESOLVED },
      ACTOR_ID,
    );
  });

  it.each([
    ['findAll', ['contact.read']],
    ['findOne', ['contact.read']],
    ['update', ['contact.manage']],
  ] as const)('%s requires %s', (method, permissions) => {
    const handler = (
      ContactMessagesController.prototype as unknown as Record<
        string,
        unknown
      >
    )[method] as () => void;

    expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual(
      permissions,
    );
  });
});
