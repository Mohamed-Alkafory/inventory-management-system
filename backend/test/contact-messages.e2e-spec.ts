import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';
import { resetDb, disconnectDb } from './db-utils.js';
import {
  ContactStatus,
  NotificationType,
  UserRole,
} from '../src/generated/prisma/client.js';

/**
 * Contact inbox scenarios against the real test database: public submission
 * validation/honeypot/rate limit, the SUPPORT/ADMIN boundary, assignment
 * rules, status auditing and unknown-id handling.
 */
describe('Contact messages (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let supportToken: string;
  let staffToken: string;
  let customerToken: string;

  let adminId: string;
  let supportId: string;
  let staffId: string;
  let inactiveSupportId: string;
  let messageId: string;

  const PASSWORD = 'Password123!';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new PrismaExceptionFilter(),
      new AllExceptionsFilter(),
    );
    // Tests send a unique X-Forwarded-For per public submission so the
    // per-client throttle does not leak between scenarios.
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await disconnectDb();
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();

    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const createUser = (
      name: string,
      email: string,
      role: UserRole,
      isActive = true,
    ) =>
      prisma.user.create({
        data: { name, email, passwordHash, role, isActive },
      });

    adminId = (await createUser('Admin', 'admin@example.com', UserRole.ADMIN))
      .id;
    supportId = (
      await createUser('Support', 'support@example.com', UserRole.SUPPORT)
    ).id;
    staffId = (await createUser('Staff', 'staff@example.com', UserRole.STAFF))
      .id;
    await createUser('Customer', 'customer@example.com', UserRole.CUSTOMER);
    inactiveSupportId = (
      await createUser(
        'Inactive Support',
        'inactive-support@example.com',
        UserRole.SUPPORT,
        false,
      )
    ).id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };

    adminToken = await login('admin@example.com');
    supportToken = await login('support@example.com');
    staffToken = await login('staff@example.com');
    customerToken = await login('customer@example.com');

    messageId = (
      await prisma.contactMessage.create({
        data: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          subject: 'Order question',
          message: 'Where is my order?',
          internalNote: 'Check the fulfilment queue',
        },
      })
    ).id;
  });

  const submission = (overrides: Record<string, unknown> = {}) => ({
    name: 'Jane Doe',
    email: 'submitter@example.com',
    subject: 'Order question',
    message: 'Where is my order?',
    ...overrides,
  });

  const submit = (body: Record<string, unknown>, ip: string) =>
    request(app.getHttpServer())
      .post('/api/v1/contact')
      .set('X-Forwarded-For', ip)
      .send(body);

  const inbox = (token: string) =>
    request(app.getHttpServer())
      .get('/api/v1/contact-messages')
      .set('Authorization', `Bearer ${token}`);

  describe('POST /contact (public)', () => {
    it('stores a valid submission and returns only { received: true }', async () => {
      const res = await submit(submission(), '10.0.0.1').expect(201);

      expect(res.body).toEqual({ received: true });

      const saved = await prisma.contactMessage.findFirst({
        where: { email: 'submitter@example.com' },
      });
      expect(saved).toMatchObject({
        name: 'Jane Doe',
        subject: 'Order question',
        message: 'Where is my order?',
        status: ContactStatus.NEW,
        assignedToId: null,
        internalNote: null,
      });

      // Only active SUPPORT receives the new-message alert.
      const notifications = await prisma.notification.findMany({
        where: { type: NotificationType.CONTACT_MESSAGE_RECEIVED },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        userId: supportId,
        entityType: 'contact_message',
        entityId: saved?.id,
      });
    });

    it('trims the submitted text fields', async () => {
      await submit(
        {
          name: '  Jane Doe  ',
          email: '  submitter@example.com ',
          subject: '  Order question  ',
          message: '  Where is my order?  ',
        },
        '10.0.0.2',
      ).expect(201);

      const saved = await prisma.contactMessage.findFirst({
        where: { email: 'submitter@example.com' },
      });
      expect(saved).toMatchObject({
        name: 'Jane Doe',
        email: 'submitter@example.com',
        subject: 'Order question',
        message: 'Where is my order?',
      });
    });

    it('discards a honeypot submission without saving it', async () => {
      await submit(
        submission({
          email: 'bot@example.com',
          honeypot: 'https://spam.example',
        }),
        '10.0.0.3',
      ).expect(201);
      await expect(
        prisma.contactMessage.count({ where: { email: 'bot@example.com' } }),
      ).resolves.toBe(0);
    });

    it.each([
      {
        label: 'name over 100',
        override: { name: 'n'.repeat(101) },
        ip: '10.0.1.1',
      },
      {
        label: 'invalid email',
        override: { email: 'not-an-email' },
        ip: '10.0.1.2',
      },
      {
        label: 'subject over 200',
        override: { subject: 's'.repeat(201) },
        ip: '10.0.1.3',
      },
      {
        label: 'message over 5000',
        override: { message: 'm'.repeat(5001) },
        ip: '10.0.1.4',
      },
      {
        label: 'unknown field',
        override: { status: 'RESOLVED' },
        ip: '10.0.1.5',
      },
    ])('rejects $label with 400', async ({ override, ip }) => {
      // A unique client per assertion keeps the 5/hour route limit isolated.
      await submit(submission(override), ip).expect(400);
    });

    it('is throttled to 5 requests per hour per client', async () => {
      for (let i = 0; i < 5; i += 1) {
        await submit(submission(), '10.0.0.9').expect(201);
      }
      await submit(submission(), '10.0.0.9').expect(429);
    });
  });

  describe('inbox authorization', () => {
    it.each([
      ['CUSTOMER', () => customerToken],
      ['STAFF', () => staffToken],
    ])('%s cannot list or update contact messages (403)', async (_role, token) => {
      const auth = { Authorization: `Bearer ${token()}` };

      await inbox(token()).expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/contact-messages/${messageId}`)
        .set(auth)
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/api/v1/contact-messages/${messageId}`)
        .set(auth)
        .send({ status: 'IN_PROGRESS' })
        .expect(403);
    });

    it('SUPPORT can list and read the inbox', async () => {
      const list = await inbox(supportToken).expect(200);

      expect(list.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
      expect(list.body.data[0]).toMatchObject({
        id: messageId,
        internalNote: 'Check the fulfilment queue',
        assignedTo: null,
      });

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/contact-messages/${messageId}`)
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(200);
      expect(detail.body.id).toBe(messageId);
    });

    it('ADMIN can list and read the inbox', async () => {
      const list = await inbox(adminToken).expect(200);
      expect(list.body.data).toHaveLength(1);

      await request(app.getHttpServer())
        .get(`/api/v1/contact-messages/${messageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('filters by status and searches name, email and subject', async () => {
      await prisma.contactMessage.create({
        data: {
          name: 'Other Person',
          email: 'other@example.com',
          subject: 'Unrelated',
          message: 'Nothing to see',
          status: ContactStatus.RESOLVED,
        },
      });

      const resolved = await request(app.getHttpServer())
        .get('/api/v1/contact-messages?status=RESOLVED&search=other')
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(200);

      expect(resolved.body.meta.total).toBe(1);
      expect(resolved.body.data[0].email).toBe('other@example.com');
    });
  });

  describe('PATCH /contact-messages/:id', () => {
    it('SUPPORT can triage status, assignee and internal note', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/contact-messages/${messageId}`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({
          status: 'IN_PROGRESS',
          assignedToId: supportId,
          internalNote: 'Investigating',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'IN_PROGRESS',
        assignedToId: supportId,
        internalNote: 'Investigating',
        assignedTo: {
          id: supportId,
          name: 'Support',
          role: 'SUPPORT',
        },
      });
    });

    it('ADMIN can resolve a message and write the audit entry', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/contact-messages/${messageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(res.body.status).toBe('RESOLVED');

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'contact_message.status_changed',
          entityType: 'contact_message',
          entityId: messageId,
        },
      });
      expect(audit).toMatchObject({
        userId: adminId,
        oldValues: { status: 'NEW' },
        newValues: { status: 'RESOLVED', changedBy: adminId },
      });
    });

    it('unassigns and clears the internal note with null', async () => {
      await prisma.contactMessage.update({
        where: { id: messageId },
        data: { assignedToId: supportId, internalNote: 'Temporary' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/contact-messages/${messageId}`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ assignedToId: null, internalNote: null })
        .expect(200);

      expect(res.body.assignedToId).toBeNull();
      expect(res.body.assignedTo).toBeNull();
      expect(res.body.internalNote).toBeNull();
    });

    it.each([
      ['an unknown id', '99999999-9999-4999-8999-999999999999'],
      ['an inactive SUPPORT user', () => inactiveSupportId],
      ['a STAFF user', () => staffId],
    ])('rejects %s as assignee with 404', async (_label, id) => {
      const assigneeId = typeof id === 'function' ? id() : id;

      await request(app.getHttpServer())
        .patch(`/api/v1/contact-messages/${messageId}`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ assignedToId: assigneeId })
        .expect(404);

      const unchanged = await prisma.contactMessage.findUnique({
        where: { id: messageId },
      });
      expect(unchanged?.assignedToId).toBeNull();
    });

    it('answers 404 for an unknown message id (GET)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/contact-messages/99999999-9999-4999-8999-999999999999')
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(404);
    });

    it('answers 404 for an unknown message id (PATCH)', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/contact-messages/99999999-9999-4999-8999-999999999999')
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ status: 'RESOLVED' })
        .expect(404);
    });
  });
});
