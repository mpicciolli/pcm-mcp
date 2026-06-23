# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **read-only** Model Context Protocol (MCP) server that exposes Pro Cycling Manager
(PCM) game saves to an LLM client over stdio. PCM stores careers as binary `.cdb`
files; this server discovers and inspects those saves but **never writes to or
modifies them**. Any new tool must keep this read-only guarantee — the server only
reads from disk.

## Commands

```bash
npm run build        # bundle src/ -> build/ with tsup (ESM + CJS, .d.ts)
npm test             # run the vitest suite once
npm run test:watch   # vitest in watch mode
npm run coverage     # vitest with v8 coverage (text + html + lcov)
npm run lint         # biome lint --write . (autofixes)
npm run format       # biome format --write .
```
