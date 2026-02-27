# discord-meeting-bot

**Status: in progress.**

A Discord bot that transcribes and summarizes meetings.

## Present Features

- **/start** — Start a meeting session from a voice channel. The bot posts a disclaimer with Accept/Reject buttons for all participants. Only one active session per voice channel.
- **/close** — End the session and delete session data. Only meeting participants can close.
- Disclaimer flow with a one-minute timeout; if not everyone accepts in time, the session is aborted.
- Session state stored in memory (no database).

## Prerequisites

- **Node.js** 18+ (or a recent LTS version)
- A [Discord application](https://discord.com/developers/applications) with a bot user
- Bot invited to your server with appropriate permissions

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd discord-meeting-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env-example` to `.env` and fill in your values (see Configuration):
   ```bash
   cp .env-example .env
   ```

## Configuration

The file `.env-example` lists the required environment variables. After copying it to `.env`, set:

| Variable        | Description |
|----------------|-------------|
| `DISCORD_TOKEN` | Your bot token (Discord Developer Portal → Bot → Reset Token) |
| `APP_ID`        | Application ID (Developer Portal → General Information) |
| `SERVER_ID`     | Guild (server) ID where you want to register slash commands |
| `PUBLIC_KEY`    | Your application's public key (Developer Portal → General Information) |

## Usage

1. **Register slash commands** (run once, or after changing command names/options):
   ```bash
   node deploy-commands.js
   ```

2. **Start the bot**:
   ```bash
   node index.js
   ```

You can add scripts to `package.json` for convenience, e.g. `"start": "node index.js"` and `"deploy": "node deploy-commands.js"`.

## Commands

| Command   | Description |
|----------|-------------|
| `/start` | Starts procedures for a meeting. You must be in a voice channel. Posts a disclaimer and lists participants; each must click Accept or Reject. Session times out after 1 minute if not everyone accepts. |
| `/close` | Closes the session and deletes session data. You must be in the same voice channel, be a participant, and the disclaimer must have been accepted by all. |

## Project structure

- `index.js` — Entry point; loads commands, events, and starts the client with Guilds + GuildVoiceStates intents.
- `deploy-commands.js` — Registers slash commands to a single guild (uses `APP_ID`, `SERVER_ID`, `DISCORD_TOKEN`).
- `commands/utility/` — Slash command definitions: `start.js`, `close.js`.
- `events/` — Event handlers: `ready.js`, `interactionCreate.js`.
- `session.js` — In-memory session store (`sessionStore`: create, get by message/channel, delete, channelHasSession).
- `handleDisclaimerButtons.js` — Handles Accept/Reject button interactions for the disclaimer message.

## License

Private / no license specified.
