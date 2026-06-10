# WorldCup AI Predictor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable World Cup information and AI prediction website.

**Architecture:** Use a no-build Node.js server with static browser modules. Keep tournament data, prediction logic, API serving, and UI rendering in separate files so Kimi rules and real data can be added without reshaping the app.

**Tech Stack:** Node.js ESM, built-in `node:test`, native HTML/CSS/JavaScript, optional Kimi API via `fetch`.

---

## File Structure

- `package.json`: project metadata and scripts.
- `server.js`: static server and `/api/predict`.
- `index.html`: app shell.
- `src/data.js`: demo schedule, teams, players, and team ratings.
- `src/prediction.js`: prediction logic and Kimi integration.
- `src/app.js`: frontend rendering and interaction.
- `src/styles.css`: visual design.
- `tests/prediction.test.js`: automated prediction tests.

## Tasks

- [ ] Add failing tests for local prediction normalization, Kimi prompt generation, and fallback behavior.
- [ ] Implement prediction core until tests pass.
- [ ] Add server routes for static assets and `POST /api/predict`.
- [ ] Add responsive frontend UI for schedule, teams, rosters, and prediction.
- [ ] Run tests and start the server.
- [ ] Verify the site in a browser and fix visible layout or interaction issues.
