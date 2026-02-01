import { z } from "zod";

export const HeartbeatPayloadSchema = z.object({
  projectId: z.string(),
  packVersion: z.number(),
  ip: z.string().optional(),
  domain: z.string().optional(),
  status: z.string().optional(),
});

export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;

export interface HeartbeatResponse {
  ok: boolean;
  serverTime: string;
}
