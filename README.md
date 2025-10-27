AgroTrace Monorepo
===================

Overview
- Backend API: Node.js + Fastify + TypeScript
- Mobile app: Expo (React Native) skeleton
- Focus: Groups with committees and subgroups, farm visits with rubrics, voice/photo capture stubs, QR traceability, nutrition comparison, and environmental metrics.

Quick Start
- Copy `.env.example` to `backend/.env`.
- Install dependencies: `npm install`.
- Start the backend: `npm run dev:backend`.
  - Defaults to `PORT=4000` (from `backend/.env`).
  - You can override by setting `PORT` when launching, e.g. `PORT=3000 npm run dev:backend`.
- Start the mobile app: install Expo CLI (`npm i -g expo`), then `npm run dev:mobile`.
  - The mobile app reads the API base from `EXPO_PUBLIC_API_URL`.
  - Update `mobile/.env` if you change the backend port or run on a device.

VPS Emulator Setup
- See `docs/VPS-EMULATOR-SETUP.md` for a step-by-step guide to run an Android emulator on a KVM VPS and expose it via WebRTC, and to run this app against it.

Examples
- Backend on default port:
  - Ensure `mobile/.env` contains `EXPO_PUBLIC_API_URL=http://localhost:4000`.
- Backend on 3000:
  - Launch: `PORT=3000 npm run dev:backend`.
  - Update `mobile/.env` to `EXPO_PUBLIC_API_URL=http://localhost:3000`.
- Physical device on same Wi‑Fi:
  - Replace `localhost` with your machine LAN IP, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.50:4000`.

Health Check
- Backend health endpoint: `GET /health` returns `{ ok: true }`.

Features Implemented
- Group creation with ethics committee constraint (2 agricultural + 1 outsider)
- Subgroups under groups
- Manager approval flow for user memberships
- Visits: ethics, peer evaluation, surprise with rubric + report
- Media: photos categorized (people, tools, plants, place_before, place_after) with geotag
- Voice note ingestion with language + transcript placeholder
- QR code generation for product batches; link story + nutrition data
- Nutrition comparison via Open Food Facts (barcode)
- Environmental metrics: distance from farm to purchase point

Notes
- This is a minimal, runnable foundation with clear extension points for Whisper and PlantNet integrations.
