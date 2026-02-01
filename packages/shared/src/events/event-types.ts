export const EVENT_TYPES = {
  // Run lifecycle
  RUN_STARTED: "run.started",
  RUN_FINISHED: "run.finished",

  // Planning
  PLAN_CREATED: "plan.created",

  // Tool usage
  TOOL_CALLED: "tool.called",
  TOOL_RESULT: "tool.result",

  // Approvals
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_RESOLVED: "approval.resolved",

  // Memory
  MEMORY_WRITE: "memory.write",

  // Security
  SECURITY_WARNING: "security.warning",

  // Errors
  ERROR: "error",

  // Chat
  CHAT_USER_MESSAGE: "chat.user_message",
  CHAT_BOT_MESSAGE: "chat.bot_message",

  // Bootstrap
  BOOTSTRAP_COMPLETED: "bootstrap.completed",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const EVENT_TYPE_VALUES = Object.values(EVENT_TYPES);
