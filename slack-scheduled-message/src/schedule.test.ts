import type { WebClient } from "@slack/web-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleSlackMessage } from "./schedule.js";

vi.mock("openclaw/plugin-sdk", () => ({
  resolveSlackAccount: () => ({
    accountId: "default",
    botToken: "xoxb-test-token",
    botTokenSource: "config" as const,
    config: {},
  }),
}));

function createMockClient() {
  return {
    conversations: {
      open: vi.fn(async () => ({ channel: { id: "D999" } })),
    },
    chat: {
      scheduleMessage: vi.fn(async () => ({
        ok: true,
        scheduled_message_id: "Q1234567890",
        post_at: 1704070800,
      })),
    },
  } as unknown as WebClient & {
    conversations: { open: ReturnType<typeof vi.fn> };
    chat: { scheduleMessage: ReturnType<typeof vi.fn> };
  };
}

// biome-ignore lint: test config object
const MOCK_CONFIG = {} as any;

// Fixed time: 2024-01-01 00:00:00 UTC (1704067200)
const FIXED_NOW_MS = 1704067200000;
const FIXED_NOW_S = 1704067200;

describe("scheduleSlackMessage", () => {
  let originalDateNow: () => number;

  beforeEach(() => {
    originalDateNow = Date.now;
    Date.now = () => FIXED_NOW_MS;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  it("rejects empty message", async () => {
    const client = createMockClient();
    await expect(
      scheduleSlackMessage({
        to: "channel:C123",
        message: "",
        postAt: FIXED_NOW_S + 3600,
        config: MOCK_CONFIG,
        client,
      }),
    ).rejects.toThrow("Slack schedule requires text message");
  });

  it("rejects whitespace-only message", async () => {
    const client = createMockClient();
    await expect(
      scheduleSlackMessage({
        to: "channel:C123",
        message: "   ",
        postAt: FIXED_NOW_S + 3600,
        config: MOCK_CONFIG,
        client,
      }),
    ).rejects.toThrow("Slack schedule requires text message");
  });

  it("rejects postAt in the past", async () => {
    const client = createMockClient();
    await expect(
      scheduleSlackMessage({
        to: "channel:C123",
        message: "Hello",
        postAt: FIXED_NOW_S - 60,
        config: MOCK_CONFIG,
        client,
      }),
    ).rejects.toThrow("postAt must be at least 15 seconds in the future");
  });

  it("rejects postAt too close to now (within 15s buffer)", async () => {
    const client = createMockClient();
    await expect(
      scheduleSlackMessage({
        to: "channel:C123",
        message: "Hello",
        postAt: FIXED_NOW_S + 5,
        config: MOCK_CONFIG,
        client,
      }),
    ).rejects.toThrow("postAt must be at least 15 seconds in the future");
  });

  it("rejects postAt at exactly the buffer boundary", async () => {
    const client = createMockClient();
    await expect(
      scheduleSlackMessage({
        to: "channel:C123",
        message: "Hello",
        postAt: FIXED_NOW_S + 15,
        config: MOCK_CONFIG,
        client,
      }),
    ).rejects.toThrow("postAt must be at least 15 seconds in the future");
  });

  it("rejects postAt more than 120 days in the future", async () => {
    const client = createMockClient();
    await expect(
      scheduleSlackMessage({
        to: "channel:C123",
        message: "Hello",
        postAt: FIXED_NOW_S + 121 * 24 * 60 * 60,
        config: MOCK_CONFIG,
        client,
      }),
    ).rejects.toThrow("postAt must be within 120 days");
  });

  it("schedules a message to a channel", async () => {
    const client = createMockClient();
    const futureTs = FIXED_NOW_S + 3600;
    const result = await scheduleSlackMessage({
      to: "channel:C123",
      message: "Hello future!",
      postAt: futureTs,
      config: MOCK_CONFIG,
      client,
    });

    expect(client.chat.scheduleMessage).toHaveBeenCalledWith({
      channel: "C123",
      text: "Hello future!",
      post_at: futureTs,
    });
    expect(result).toEqual({
      scheduledMessageId: "Q1234567890",
      postAt: 1704070800,
      channelId: "C123",
    });
  });

  it("schedules a message to a user (opens DM)", async () => {
    const client = createMockClient();
    const futureTs = FIXED_NOW_S + 3600;
    const result = await scheduleSlackMessage({
      to: "user:U456",
      message: "Hello user!",
      postAt: futureTs,
      config: MOCK_CONFIG,
      client,
    });

    expect(client.conversations.open).toHaveBeenCalledWith({ users: "U456" });
    expect(client.chat.scheduleMessage).toHaveBeenCalledWith({
      channel: "D999",
      text: "Hello user!",
      post_at: futureTs,
    });
    expect(result.channelId).toBe("D999");
  });

  it("includes thread_ts when threadTs is provided", async () => {
    const client = createMockClient();
    const futureTs = FIXED_NOW_S + 3600;
    await scheduleSlackMessage({
      to: "channel:C123",
      message: "Thread reply",
      postAt: futureTs,
      threadTs: "1234567890.123456",
      config: MOCK_CONFIG,
      client,
    });

    expect(client.chat.scheduleMessage).toHaveBeenCalledWith({
      channel: "C123",
      text: "Thread reply",
      post_at: futureTs,
      thread_ts: "1234567890.123456",
    });
  });

  it("accepts postAt at exactly 120 days", async () => {
    const client = createMockClient();
    const maxTs = FIXED_NOW_S + 120 * 24 * 60 * 60;
    const result = await scheduleSlackMessage({
      to: "channel:C123",
      message: "Last day!",
      postAt: maxTs,
      config: MOCK_CONFIG,
      client,
    });
    expect(result.scheduledMessageId).toBe("Q1234567890");
  });

  it("handles # prefix for channels", async () => {
    const client = createMockClient();
    const futureTs = FIXED_NOW_S + 3600;
    await scheduleSlackMessage({
      to: "#C789",
      message: "Hash target",
      postAt: futureTs,
      config: MOCK_CONFIG,
      client,
    });

    expect(client.chat.scheduleMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C789" }),
    );
  });

  it("handles @ prefix for users", async () => {
    const client = createMockClient();
    const futureTs = FIXED_NOW_S + 3600;
    await scheduleSlackMessage({
      to: "@U111",
      message: "At target",
      postAt: futureTs,
      config: MOCK_CONFIG,
      client,
    });

    expect(client.conversations.open).toHaveBeenCalledWith({ users: "U111" });
  });

  it("handles <@U123> mention format", async () => {
    const client = createMockClient();
    const futureTs = FIXED_NOW_S + 3600;
    await scheduleSlackMessage({
      to: "<@U222>",
      message: "Mention target",
      postAt: futureTs,
      config: MOCK_CONFIG,
      client,
    });

    expect(client.conversations.open).toHaveBeenCalledWith({ users: "U222" });
  });
});
