# slack-scheduled-message

An OpenClaw plugin that adds a `slack_schedule_message` tool, letting the AI agent schedule Slack messages for future delivery via the [`chat.scheduleMessage`](https://api.slack.com/methods/chat.scheduleMessage) API.

## Features

- Schedule messages to channels, DMs, or threads
- Flexible target formats: channel ID, user ID, or prefixed forms (`channel:C123`, `user:U123`, `#C123`, `@U123`, `<@U123>`)
- Automatically opens a DM conversation when targeting a user
- Validates that `postAt` is between 15 seconds and 120 days in the future
- Multi-account support via optional `accountId` parameter

## Tool parameters

| Parameter   | Required | Description                                                    |
|-------------|----------|----------------------------------------------------------------|
| `to`        | yes      | Slack target: channel ID, user ID, or prefixed form            |
| `message`   | yes      | The text message to schedule                                   |
| `postAt`    | yes      | Unix timestamp (seconds) for delivery (15 s – 120 days ahead)  |
| `threadId`  | no       | Thread timestamp (`thread_ts`) to reply in a thread            |
| `accountId` | no       | Slack account ID for multi-account setups                      |

## Installation

```bash
openclaw plugins install .
```

Requires a Slack bot token configured in your OpenClaw Slack account settings (`channels.slack.accounts.<id>.botToken` or the `SLACK_BOT_TOKEN` env var).

## Development

```bash
npm install
```
