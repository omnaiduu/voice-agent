# Voice Agent Monorepo


## Core Rules (Never break these)

- **Readability > Cleverness**  
  If code takes >2 seconds to understand, rewrite it.
- Never use dense one-liners, nested ternaries, `||`/`??` fallbacks, or non-null assertions (`!`) unless the user explicitly asks for “maximum brevity”.
- One clear purpose per line and per small function.
- Prefer early returns and flat code.
- Comment *why*, not *what*.
- Never mutate state inside Zustand `set()`.
- Extract small, pure, named helper functions.
- Use descriptive names (`getSessionId`, `stopAllTracks`, `createNewParticipant`).
- Handle edge cases explicitly with early returns.

## Structure

- Monorepo with Turborepo and Bun package manager
- Apps: `backend` (TRPC server), `frontend` (React Router v7 app)
- No shared packages

## Development Commands

- Start all: `turbo run dev` (runs backend on 3001, frontend dev server with /trpc proxy)
- Build: `turbo run build`
- Lint: `turbo run lint` (Biome check)
- Typecheck: `turbo run check-types` (frontend: react-router typegen && tsc)
- Format: `prettier --write "**/*.{ts,tsx,md}"`

## Environment Setup

- Backend requires Redis: `cd apps/backend && bun run start:redis`
- SFU types: `cd apps/backend && bun run generate:sfu` (uses Cloudflare API)

## Quirks

- Biome config: tabs for indent, double quotes
- Frontend uses Vite with Tailwind CSS v4
- TRPC client connects to /trpc (proxied to backend)</content>
  <parameter name="filePath">/workspaces/voice-agent/AGENTS.md
