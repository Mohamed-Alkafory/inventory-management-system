import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { auditApi } from "./api";
import type { AuditListParams } from "./types";

export const auditKeys = {
  all: ["audit-logs"] as const,
  list: (p: AuditListParams) => [...auditKeys.all, "list", p] as const,
};

export const useAuditLogs = (params: AuditListParams) =>
  useQuery({ queryKey: auditKeys.list(params), queryFn: () => auditApi.list(params), placeholderData: keepPreviousData });
