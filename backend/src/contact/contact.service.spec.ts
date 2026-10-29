import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ContactStatus } from '../generated/prisma/enums.js';
import { ContactService } from './contact.service.js';
import { type ListContactMessagesQueryDto } from './dto/list-contact-messages.query.dto.js';
import { type CreateContactMessageDto } from './dto/create-contact-message.dto.js';

const MESSAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUPPORT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACTOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const messageRow = (overrides: Record<string, unknown> = {}) => ({
  id: MESSAGE_ID,
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Help',
  message: 'Please help me',
  status: ContactStatus.NEW,
  assignedToId: null,
  assignedTo: null,
  internalNote: null,
  createdAt: new Date('2026-10-30T12:00:00Z'),
  updatedAt: new Date('2026-10-30T12:00:00Z'),
  ...overrides,
});

const validSubmission = (
  overrides: Partial<CreateContactMessageDto> = {},
): CreateContactMessageDto => ({
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Help',
  message: 'Please help me',
  ...overrides,
});

describe('ContactService', () => {
  let service: ContactService;

  const $transaction = vi.fn();
  const contactMessageCreate = vi.fn();
  const contactMessageCount = vi.fn();
  const contactMessageFindMany = vi.fn();
  const contactMessageFindUnique = vi.fn();
  const contactMessageUpdate = vi.fn();
  const userFindFirst = vi.fn();
  const auditLog = vi.fn();
  const notifyContactMessageReceived = vi.fn();

  const tx = {
    contactMessage: {
      findUnique: contactMessageFindUnique,
      update: contactMessageUpdate,
    },
    user: { findFirst: userFindFirst },
  };

  beforeEach(async () => {
    $transaction
      .mockReset()
      .mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    contactMessageCreate
      .mockReset()
      .mockResolvedValue(messageRow());
    contactMessageCount.mockReset().mockResolvedValue(1);
    contactMessageFindMany
      .mockReset()
      .mockResolvedValue([messageRow()]);
    contactMessageFindUnique
      .mockReset()
      .mockResolvedValue(messageRow());
    contactMessageUpdate
      .mockReset()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        messageRow(data),
      );
    userFindFirst.mockReset().mockResolvedValue({ id: SUPPORT_ID });
    auditLog.mockReset().mockResolvedValue(undefined);
    notifyContactMessageReceived.mockReset().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        {
          provide: PrismaService,
          useValue: {
            contactMessage: {
              create: contactMessageCreate,
              count: contactMessageCount,
              findMany: contactMessageFindMany,
              findUnique: contactMessageFindUnique,
            },
            $transaction,
          },
        },
        { provide: AuditService, useValue: { log: auditLog } },
        {
          provide: NotificationsService,
          useValue: { notifyContactMessageReceived },
        },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  describe('create', () => {
    it('stores a public submission and returns only the acknowledgement', async () => {
      await expect(service.create(validSubmission())).resolves.toEqual({
        received: true,
      });
      expect(contactMessageCreate).toHaveBeenCalledWith({
        data: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          subject: 'Help',
          message: 'Please help me',
        },
      });
      expect(notifyContactMessageReceived).toHaveBeenCalledWith({
        id: MESSAGE_ID,
        subject: 'Help',
      });
    });

    it('silently discards a submission with a non-empty honeypot', async () => {
      await expect(
        service.create(validSubmission({ honeypot: 'https://spam.example' })),
      ).resolves.toEqual({ received: true });
      expect(contactMessageCreate).not.toHaveBeenCalled();
    });

    it('treats an empty honeypot as a real submission', async () => {
      await service.create(validSubmission({ honeypot: '' }));
      expect(contactMessageCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('applies status, assignee and case-insensitive search filters', async () => {
      const query = {
        page: 2,
        limit: 10,
        status: ContactStatus.IN_PROGRESS,
        assignedToId: SUPPORT_ID,
        search: 'jane',
      } as ListContactMessagesQueryDto;

      const result = await service.findAll(query);

      expect(contactMessageCount).toHaveBeenCalledWith({
        where: {
          status: ContactStatus.IN_PROGRESS,
          assignedToId: SUPPORT_ID,
          OR: [
            { name: { contains: 'jane', mode: 'insensitive' } },
            { email: { contains: 'jane', mode: 'insensitive' } },
            { subject: { contains: 'jane', mode: 'insensitive' } },
          ],
        },
      });
      expect(contactMessageFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('defaults to page 1 / limit 20 with no filters', async () => {
      await service.findAll({} as ListContactMessagesQueryDto);
      expect(contactMessageFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, where: {} }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the private inbox shape', async () => {
      await expect(service.findOne(MESSAGE_ID)).resolves.toEqual(messageRow());
      expect(contactMessageFindUnique).toHaveBeenCalledWith({
        where: { id: MESSAGE_ID },
        select: expect.any(Object),
      });
    });

    it('throws 404 for an unknown id', async () => {
      contactMessageFindUnique.mockResolvedValue(null);
      await expect(service.findOne(MESSAGE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('assigns an active SUPPORT/ADMIN user and audits status changes', async () => {
      await service.update(
        MESSAGE_ID,
        {
          status: ContactStatus.IN_PROGRESS,
          assignedToId: SUPPORT_ID,
          internalNote: 'Investigating',
        },
        ACTOR_ID,
      );

      expect(userFindFirst).toHaveBeenCalledWith({
        where: {
          id: SUPPORT_ID,
          isActive: true,
          role: { in: ['SUPPORT', 'ADMIN'] },
        },
        select: { id: true },
      });
      expect(contactMessageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MESSAGE_ID },
          data: {
            status: ContactStatus.IN_PROGRESS,
            assignedToId: SUPPORT_ID,
            internalNote: 'Investigating',
          },
        }),
      );
      expect(auditLog).toHaveBeenCalledWith(
        {
          userId: ACTOR_ID,
          action: 'contact_message.status_changed',
          entityType: 'contact_message',
          entityId: MESSAGE_ID,
          oldValues: { status: ContactStatus.NEW },
          newValues: {
            status: ContactStatus.IN_PROGRESS,
            changedBy: ACTOR_ID,
          },
        },
        tx,
      );
    });

    it('does not write an audit entry when the status is unchanged', async () => {
      await service.update(
        MESSAGE_ID,
        { status: ContactStatus.NEW, internalNote: 'Note' },
        ACTOR_ID,
      );
      expect(auditLog).not.toHaveBeenCalled();
    });

    it('unassigns with a null id without looking the user up', async () => {
      await service.update(MESSAGE_ID, { assignedToId: null }, ACTOR_ID);
      expect(userFindFirst).not.toHaveBeenCalled();
      expect(contactMessageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { assignedToId: null } }),
      );
    });

    it.each([
      ['unknown', null],
      ['inactive', null],
      ['wrong role', null],
    ])('rejects an %s assignee with 404', async (_label) => {
      userFindFirst.mockResolvedValue(null);
      await expect(
        service.update(MESSAGE_ID, { assignedToId: SUPPORT_ID }, ACTOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(contactMessageUpdate).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });

    it('throws 404 when the message does not exist', async () => {
      contactMessageFindUnique.mockResolvedValue(null);
      await expect(
        service.update(MESSAGE_ID, { status: ContactStatus.RESOLVED }, ACTOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(contactMessageUpdate).not.toHaveBeenCalled();
    });
  });
});
