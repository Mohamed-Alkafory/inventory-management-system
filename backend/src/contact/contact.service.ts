import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ContactStatus, UserRole } from '../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';
import { ListContactMessagesQueryDto } from './dto/list-contact-messages.query.dto.js';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto.js';

/** Public submission acknowledgement — deliberately contains no row data. */
export interface ContactSubmissionResponse {
  received: true;
}

/** Assignee snapshot shown inside the private support inbox. */
export interface ContactAssigneeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Private inbox shape; `internalNote` and `assignedTo` never leave this API. */
export interface ContactMessageResponse {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  assignedToId: string | null;
  assignedTo: ContactAssigneeResponse | null;
  internalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactMessageListResponse {
  data: ContactMessageResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const CONTACT_MESSAGE_SELECT = {
  id: true,
  name: true,
  email: true,
  subject: true,
  message: true,
  status: true,
  assignedToId: true,
  assignedTo: {
    select: { id: true, name: true, email: true, role: true },
  },
  internalNote: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactMessageSelect;

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * `POST /contact` — stores a public submission. The honeypot is checked
   * first: a filled field answers 201 with the same acknowledgement but
   * writes nothing, so bots cannot tell they were filtered out.
   */
  async create(dto: CreateContactMessageDto): Promise<ContactSubmissionResponse> {
    if (dto.honeypot) {
      return { received: true };
    }

    const message = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
      },
    });

    // After the insert commits: best-effort, never fails the submission.
    await this.notifications.notifyContactMessageReceived({
      id: message.id,
      subject: message.subject,
    });

    return { received: true };
  }

  /** `GET /contact-messages` — newest first, with deterministic tie-breaks. */
  async findAll(
    query: ListContactMessagesQueryDto,
  ): Promise<ContactMessageListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ContactMessageWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { subject: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, messages] = await Promise.all([
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: CONTACT_MESSAGE_SELECT,
      }),
    ]);

    return {
      data: messages,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** `GET /contact-messages/:id` — 404 for an unknown id. */
  async findOne(id: string): Promise<ContactMessageResponse> {
    const message = await this.prisma.contactMessage.findUnique({
      where: { id },
      select: CONTACT_MESSAGE_SELECT,
    });

    if (!message) {
      throw new NotFoundException(`Contact message ${id} not found`);
    }

    return message;
  }

  /**
   * `PATCH /contact-messages/:id` — triage a message. A status change writes
   * an audit entry in the same transaction with the actor, from and to. The
   * assignee must be an active SUPPORT or ADMIN user; every other id (unknown,
   * inactive or a different role) answers the same 404.
   */
  async update(
    id: string,
    dto: UpdateContactMessageDto,
    actorId: string,
  ): Promise<ContactMessageResponse> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.contactMessage.findUnique({
        where: { id },
        select: CONTACT_MESSAGE_SELECT,
      });

      if (!current) {
        throw new NotFoundException(`Contact message ${id} not found`);
      }

      if (dto.assignedToId) {
        const assignee = await tx.user.findFirst({
          where: {
            id: dto.assignedToId,
            isActive: true,
            role: { in: [UserRole.SUPPORT, UserRole.ADMIN] },
          },
          select: { id: true },
        });

        if (!assignee) {
          throw new NotFoundException(
            `Assignee ${dto.assignedToId} not found`,
          );
        }
      }

      const data: Prisma.ContactMessageUncheckedUpdateInput = {};
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.assignedToId !== undefined) {
        data.assignedToId = dto.assignedToId;
      }
      if (dto.internalNote !== undefined) {
        data.internalNote = dto.internalNote;
      }

      const updated = await tx.contactMessage.update({
        where: { id },
        data,
        select: CONTACT_MESSAGE_SELECT,
      });

      if (dto.status !== undefined && dto.status !== current.status) {
        await this.audit.log(
          {
            userId: actorId,
            action: 'contact_message.status_changed',
            entityType: 'contact_message',
            entityId: id,
            oldValues: { status: current.status },
            newValues: { status: updated.status, changedBy: actorId },
          },
          tx,
        );
      }

      return updated;
    });
  }
}
