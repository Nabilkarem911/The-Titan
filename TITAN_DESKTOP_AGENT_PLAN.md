# TITAN DESKTOP AGENT — IMPLEMENTATION PLAN

> **Golden Rule: Nothing breaks. No existing functionality is modified. All new features are additive.**

---

## Architecture Overview

```
┌─────────────┐     Telegram      ┌─────────────┐     WebSocket      ┌──────────────────┐
│   Telegram   │ ──────────────→  │  Titan Server │ ────────────────→  │  Desktop Client  │
│   (User)     │                  │  (Agent + AI) │  ←──────────────  │  (Electron App)   │
└─────────────┘                  └─────────────┘     Results          └──────────────────┘
                                         │                                    │
                                    ┌────┴────┐                          ┌────┴────┐
                                    │ Postgres │                          │  Local   │
                                    │ + Redis  │                          │  Machine │
                                    │ + Memory │                          │ (Files,  │
                                    └─────────┘                          │  Shell,  │
                                                                         │  Apps)   │
                                                                         └─────────┘
```

**Flow:**
1. User sends message from Telegram or Desktop UI
2. Titan agent understands it's a local machine task
3. Agent calls `desktop_*` tool → Desktop Bridge sends command via WebSocket to the user's connected device
4. Desktop Client executes locally and returns result
5. Agent responds to user with the result
6. Everything is stored in Titan's memory system on the server

---

## What Already Exists (DO NOT TOUCH)

| Component | Location | Role |
|-----------|----------|------|
| WebSocket Server | `packages/websocket/src/server.ts` | JSON-RPC 2.0 over WS with auth, rate limiting, backpressure |
| RPC Router | `packages/websocket/src/router.ts` | Method registration + dispatch |
| Tool Registry | `packages/agent-engine/src/tool-registry.ts` | Global singleton tool registry with caching + rate limiting |
| Tool Registration | `apps/core/src/queue-bootstrap.ts` | All 90+ tools registered here |
| Telegram Integration | `apps/core/src/routes/telegram.ts` | Webhook handler, slash commands, agent runner |
| Agent Runner | `apps/core/src/create-runner.ts` | Factory for AgentRunner with SSE + WS broadcasting |
| Auth System | `packages/auth/src/` | JWT + API key resolution |
| Config | `packages/config/src/index.ts` | Zod-validated env config |
| Database | `packages/database/src/` | Postgres repositories + migrations |
| Shared Schemas | `packages/shared/src/schemas.ts` | Zod schemas for all tool inputs |
| Sandbox | `packages/tools/src/sandbox.ts` | Command validation + forbidden patterns |

**Principle: We ADD files. We EXTEND config. We never MODIFY existing logic.**

---

## Phase 1: Desktop Bridge Core (Server Side)

### 1.1 Database Migration — `desktop_devices` table

**New file:** `packages/database/src/migrations/011_desktop_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS desktop_devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name  VARCHAR(100) NOT NULL,
  device_id    VARCHAR(100) NOT NULL,
  platform     VARCHAR(50) NOT NULL,        -- win32, darwin, linux
  hostname     VARCHAR(200),
  status       VARCHAR(20) NOT NULL DEFAULT 'offline',  -- online, offline
  last_seen_at TIMESTAMPTZ,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ['shell','files','screenshot','apps']
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_id)
);
```

### 1.2 Database Repository — `desktopDevices.ts`

**New file:** `packages/database/src/desktopDevices.ts`

Functions:
- `register(userId, deviceId, deviceName, platform, hostname, capabilities)` — upsert
- `setStatus(userId, deviceId, status)` — online/offline
- `listByUser(userId)` — all devices for a user
- `findOnline(userId)` — first online device
- `findByDeviceId(userId, deviceId)` — specific device
- `remove(userId, deviceId)` — delete device

**Export from:** `packages/database/src/index.ts` (add one line, no modification to existing exports)

### 1.3 Desktop Bridge Manager — `packages/websocket/src/desktop-bridge.ts`

**New file:** `packages/websocket/src/desktop-bridge.ts`

This is the core bridge that manages connected desktop clients.

```typescript
export class DesktopBridge {
  // deviceId → { ws, userId, deviceName, platform, capabilities }
  private connectedDevices: Map<string, ConnectedDevice>;
  // pending command_id → { resolve, reject, timeout }
  private pendingCommands: Map<string, PendingCommand>;

  // Called when a desktop client connects via WS
  registerDevice(deviceId: string, ws: WebSocket, info: DeviceInfo): void;

  // Called when a desktop client disconnects
  unregisterDevice(deviceId: string): void;

  // Send a command to a specific device and await result
  sendCommand(userId: string, deviceId: string, command: DesktopCommand): Promise<CommandResult>;

  // Handle result coming back from desktop client
  handleResult(commandId: string, result: CommandResult): void;

  // List online devices for a user
  listOnlineDevices(userId: string): DeviceInfo[];

  // Check if any device is online for a user
  hasOnlineDevice(userId: string): boolean;
}
```

**Command types:**
- `shell.execute` — run shell command
- `file.read` — read file content
- `file.write` — write file content
- `file.list` — list directory
- `file.delete` — delete file
- `file.move` — move/rename file
- `screenshot.capture` — capture screen
- `app.open` — open application
- `app.close` — close application
- `app.list` — list running processes
- `system.info` — get system info (CPU, memory, disk)

### 1.4 WebSocket RPC Methods — Desktop Bridge

**New file:** `apps/core/src/routes/desktop-bridge-rpc.ts`

Registers new RPC methods on the existing router (additive):

- `desktop.register` — desktop client registers itself (returns deviceId)
- `desktop.heartbeat` — keep-alive from desktop client
- `desktop.command_result` — desktop client sends back command result
- `desktop.list_devices` — any WS client can list their online devices
- `desktop.command` — send a command to a desktop device (from dashboard/WS client)

These are registered in `apps/core/src/index.ts` by adding one import + one function call.
The `registerRpcMethods` function gets a new call: `registerDesktopRpcMethods(router)`.

### 1.5 Config Additions

**Modify:** `packages/config/src/index.ts` — ADD new env vars (additive, all have defaults):

```typescript
DESKTOP_BRIDGE_ENABLED: z.union([z.literal('true'), z.literal('false')]).transform(v => v === 'true').default('true'),
DESKTOP_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
DESKTOP_MAX_COMMANDS_PER_MIN: z.coerce.number().int().positive().default(60),
DESKTOP_WS_PATH: z.string().default('/ws-desktop'),
```

### 1.6 Desktop Bridge Singleton

**New file:** `apps/core/src/desktop-bridge-instance.ts`

```typescript
import { DesktopBridge } from '@titan/websocket';
let _bridge: DesktopBridge | null = null;
export function setDesktopBridge(b: DesktopBridge) { _bridge = b; }
export function getDesktopBridge(): DesktopBridge | null { return _bridge; }
```

### 1.7 Integration in `index.ts`

**Modify:** `apps/core/src/index.ts` — Add 3 lines:
1. Import `registerDesktopRpcMethods` (add to existing import area)
2. Call `registerDesktopRpcMethods(router)` inside `registerRpcMethods` (additive)
3. Create + attach DesktopBridge WebSocket server (after main WS server)

```typescript
// After wsServer.attach(app.server):
if (cfg.DESKTOP_BRIDGE_ENABLED) {
  const desktopBridge = new DesktopBridge({ path: cfg.DESKTOP_WS_PATH });
  desktopBridge.attach(app.server);
  setDesktopBridge(desktopBridge);
}
```

### 1.8 Export from WebSocket Package

**Modify:** `packages/websocket/src/index.ts` — Add export for DesktopBridge (one line)

---

## Phase 2: Desktop Agent Tools

### 2.1 Tool Implementations

**New file:** `apps/core/src/desktop-tools.ts`

Each tool calls `getDesktopBridge().sendCommand(userId, deviceId, command)`.

Tools to register:

| Tool Name | Description | Schema |
|-----------|-------------|-------|
| `desktop_execute` | Execute shell command on user's device | `{ command, deviceId?, cwd?, timeoutMs? }` |
| `desktop_read_file` | Read file from user's device | `{ path, deviceId? }` |
| `desktop_write_file` | Write file on user's device | `{ path, content, deviceId? }` |
| `desktop_list_dir` | List directory contents on user's device | `{ path, deviceId? }` |
| `desktop_delete_file` | Delete file on user's device | `{ path, deviceId? }` |
| `desktop_screenshot` | Capture screenshot from user's device | `{ deviceId? }` |
| `desktop_open_app` | Open application on user's device | `{ app, deviceId? }` |
| `desktop_system_info` | Get system info from user's device | `{ deviceId? }` |
| `desktop_list_devices` | List user's connected devices | `{}` |

### 2.2 Tool Registration

**Modify:** `apps/core/src/queue-bootstrap.ts` — Add at the end (additive):

```typescript
// Desktop Agent Tools — registered only if bridge is enabled
import { registerDesktopTools } from './desktop-tools.js';
registerDesktopTools(registry);
```

Each tool:
1. Checks if DesktopBridge has an online device for the user
2. If no device online → returns `{ success: false, error: 'No desktop device connected' }`
3. If device online → sends command via bridge, awaits result
4. Returns result in standard `ToolResult` format

### 2.3 Safety: Command Validation

All `desktop_execute` commands go through the same `validateCommand()` from `packages/tools/src/sandbox.ts`.
The forbidden patterns list applies to desktop commands too.
Additional desktop-specific forbidden patterns:
- `format` (Windows format command)
- `del /f /s /q C:\` (Windows recursive delete)
- `reg delete` (Windows registry deletion)

---

## Phase 3: Electron Desktop App

### 3.1 App Structure

**New directory:** `apps/desktop/`

```
apps/desktop/
├── package.json
├── tsconfig.json
├── electron-builder.yml
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point
│   │   ├── window.ts            # Window management
│   │   ├── tray.ts              # System tray
│   │   ├── ipc-handlers.ts      # IPC between main & renderer
│   │   ├── ws-client.ts         # WebSocket client to Titan Server
│   │   ├── command-executor.ts  # Execute commands locally
│   │   └── store.ts             # Persistent settings (electron-store)
│   ├── preload/
│   │   └── index.ts             # Preload script (contextBridge)
│   └── renderer/                # React UI
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── styles/
│       │   └── globals.css      # Tailwind
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── Sidebar.tsx
│       │   ├── StatusBar.tsx
│       │   ├── ChatPanel.tsx
│       │   ├── FileExplorer.tsx
│       │   ├── Terminal.tsx
│       │   ├── ScreenshotViewer.tsx
│       │   ├── SettingsPanel.tsx
│       │   ├── DeviceManager.tsx
│       │   └── ui/              # Reusable UI components
│       │       ├── Button.tsx
│       │       ├── Input.tsx
│       │       ├── Card.tsx
│       │       ├── Badge.tsx
│       │       ├── Modal.tsx
│       │       └── Toast.tsx
│       ├── hooks/
│       │   ├── useWebSocket.ts
│       │   ├── useChat.ts
│       │   └── useFiles.ts
│       ├── stores/
│       │   └── app-store.ts     # Zustand store
│       └── lib/
│           ├── api.ts           # REST API client
│           └── ws.ts            # WS client wrapper
├── vite.config.ts
└── tailwind.config.ts
```

### 3.2 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Electron 33+ | Mature, Node.js integration, same TS stack |
| Build | Vite + electron-vite | Fast HMR, modern build |
| UI Framework | React 19 | Already used in Titan dashboard |
| Styling | TailwindCSS 4 | Already used in Titan dashboard |
| Icons | Lucide React | Consistent with dashboard |
| State | Zustand | Lightweight, no boilerplate |
| Terminal | xterm.js | Industry standard, full terminal emulation |
| File Explorer | Custom + Lucide icons | Full control over UX |
| Charts | Recharts | System info visualization |
| Notifications | sonner | Already in Titan deps |
| Animations | framer-motion | Already in Titan deps |
| Settings Store | electron-store | Persistent app settings |

### 3.3 Main Process (`src/main/`)

**`index.ts`** — App lifecycle:
- Create BrowserWindow with preload script
- Initialize WebSocket connection to Titan Server
- Set up system tray icon
- Handle app quit / window close to tray

**`ws-client.ts`** — WebSocket client:
- Connect to `ws://server/ws-desktop`
- Authenticate with JWT or API key
- Register device with capabilities
- Listen for incoming commands
- Send heartbeat every 30s
- Auto-reconnect with exponential backoff

**`command-executor.ts`** — Local command execution:
- `shell.execute` → `child_process.exec` (platform-aware: cmd/sh)
- `file.read` → `fs.readFile`
- `file.write` → `fs.writeFile` (with mkdir -p)
- `file.list` → `fs.readdir` with stat info
- `file.delete` → `fs.unlink` / `fs.rm`
- `screenshot.capture` → `screenshot-desktop` npm package
- `app.open` → `child_process.exec` (`start` on Win, `open` on Mac, `xdg-open` on Linux)
- `system.info` → `os.cpus()`, `os.totalmem()`, `os.freemem()`, disk usage

**`tray.ts`** — System tray:
- Icon with online/offline indicator
- Right-click menu: Open, Settings, Pause, Quit
- Notification on new command execution

### 3.4 Preload Script (`src/preload/index.ts`)

Exposes safe IPC bridge to renderer:
```typescript
contextBridge.exposeInMainWorld('titan', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  // Connection
  getConnectionStatus: () => ipcRenderer.invoke('connection:status'),
  // Files
  listDir: (path) => ipcRenderer.invoke('files:list', path),
  readFile: (path) => ipcRenderer.invoke('files:read', path),
  writeFile: (path, content) => ipcRenderer.invoke('files:write', path, content),
  // Shell
  executeCommand: (cmd) => ipcRenderer.invoke('shell:execute', cmd),
  // Screenshot
  takeScreenshot: () => ipcRenderer.invoke('screenshot:capture'),
  // System
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
});
```

### 3.5 Renderer UI (`src/renderer/`)

#### Design Language

- **Theme:** Dark-first with optional light mode (toggle in settings)
- **Colors:** Deep navy/slate background, electric blue accents, green for online, red for offline
- **Typography:** Inter for UI, JetBrains Mono for terminal/code
- **Spacing:** Generous padding, clear visual hierarchy
- **Animations:** Subtle framer-motion transitions (page enter/exit, sidebar collapse)
- **Glassmorphism:** Semi-transparent panels with backdrop blur for modern feel

#### Pages / Views

**1. Chat View (default)**
- Full chat interface with Titan
- Message bubbles (user right, Titan left)
- Markdown rendering with code syntax highlighting
- Streaming responses (SSE-like via WS)
- Quick action buttons: "Take Screenshot", "System Info", "List Files"
- Command execution notifications inline

**2. File Explorer**
- Tree view of local filesystem
- Breadcrumb navigation
- File operations: open, rename, delete, create folder
- File preview (text, images, code)
- Drag-and-drop file upload to Titan server
- Search bar with fuzzy match

**3. Terminal**
- Full xterm.js terminal
- Multiple tabs
- Command history
- Titan can send commands here (visual feedback when agent runs a command)

**4. Screenshot Viewer**
- Capture button
- Screenshot history (session-based)
- Annotate (draw rectangles, arrows)
- Send to Titan for analysis

**5. Settings**
- Server URL input
- Auth method: JWT (email+password) or API Key
- Device name
- Capabilities toggles (shell, files, screenshot, apps)
- Theme toggle (dark/light)
- Auto-start on boot toggle
- Minimize to tray toggle
- Connection status indicator
- Test connection button

**6. Device Manager**
- List of connected devices (from server)
- Status (online/offline)
- Last seen timestamp
- Platform info
- Disconnect button

#### Sidebar Navigation

```
┌────────────────────────────────────────────────────┐
│  [Titan Logo]  Titan Desktop              [─][□][×]│
├──────────┬─────────────────────────────────────────┤
│          │                                         │
│  💬 Chat │          Main Content Area              │
│  📁 Files│                                         │
│  ⌨ Term  │                                         │
│  📸 Shot │                                         │
│  ⚙ Set   │                                         │
│          │                                         │
│  ─────── │                                         │
│  🖥 Dev  │                                         │
│          │                                         │
├──────────┴─────────────────────────────────────────┤
│  ● Connected  |  My-PC  |  Win11  |  2.4GHz  16GB  │
└────────────────────────────────────────────────────┘
```

#### Status Bar (bottom)

- Connection status (green dot + "Connected" / red dot + "Disconnected")
- Device name
- Platform + OS version
- CPU usage + Memory usage (live)
- Active commands count

---

## Phase 4: Chat Interface (Detailed)

### 4.1 Chat Component

**`ChatPanel.tsx`** features:
- Message list with auto-scroll
- Input area with:
  - Multi-line support (Shift+Enter for newline)
  - Send button
  - Attachment button (send files to Titan)
  - Voice input button (future)
- Message rendering:
  - Markdown with `react-markdown`
  - Code blocks with syntax highlighting (`react-syntax-highlighter`)
  - Inline code styling
  - Links auto-clickable
  - Tables, lists, blockquotes
- Agent activity indicators:
  - "Thinking..." with animated dots
  - Tool execution badges (e.g., "🔧 Running desktop_execute...")
  - Step-by-step progress
- Quick actions toolbar:
  - 📸 Screenshot → sends "take a screenshot of my screen"
  - 📊 System Info → sends "show me my system info"
  - 📁 List Files → sends "list files in my Desktop"
  - 🧹 Clean Temp → sends "clean my temp files"

### 4.2 Chat API

The renderer communicates with Titan Server via:
1. **REST API** (`POST /api/v1/chat`) for non-streaming
2. **WebSocket** for streaming responses and real-time updates
3. **Direct IPC** for local operations (file browsing, terminal, screenshot)

---

## Phase 5: File Browser + Terminal + Screenshot (Detailed)

### 5.1 File Explorer

**`FileExplorer.tsx`** features:
- Sidebar tree with expand/collapse folders
- Main panel with file/folder grid or list view
- Sort by name, size, modified date
- File type icons (Lucide)
- Right-click context menu:
  - Open (in default app)
  - Open in Terminal
  - Rename
  - Delete (with confirmation)
  - Copy path
  - Send to Titan
- Address bar with breadcrumb navigation
- New folder / new file buttons
- File size formatting (KB, MB, GB)
- Empty state illustration
- Loading states with skeleton

### 5.2 Terminal

**`Terminal.tsx`** features:
- xterm.js with addons (fit, web-links, search)
- Dark theme matching app theme
- Multiple tabs (Cmd/Ctrl+T for new tab)
- Tab close button
- Split pane support (future)
- Command history (Up/Down arrows)
- Copy/paste support
- Font size adjustment
- When Titan executes a command on this device:
  - Visual indicator in terminal
  - Command and output highlighted
  - Toast notification: "Titan executed: `npm install`"

### 5.3 Screenshot Viewer

**`ScreenshotViewer.tsx`** features:
- "Capture Screen" button (large, prominent)
- Screenshot preview area
- History strip (thumbnails of past screenshots in session)
- Annotation tools:
  - Rectangle draw
  - Arrow draw
  - Text overlay
  - Crop
- "Send to Titan" button → sends image to Titan for analysis
- "Copy to clipboard" button
- "Save to file" button
- Fullscreen view

---

## Phase 6: Telegram Routing

### 6.1 Telegram Enhancement

**Modify:** `apps/core/src/routes/telegram.ts` — Add desktop context to agent system prompt (additive):

When building the `contextBlock`, add:
```typescript
// Check for online desktop devices
const bridge = getDesktopBridge();
if (bridge) {
  const devices = bridge.listOnlineDevices(ownerId);
  if (devices.length > 0) {
    contextBlock += `\n\nDesktop devices online (${devices.length}):\n`;
    devices.forEach(d => {
      contextBlock += `- ${d.deviceName} (${d.platform}) — capabilities: ${d.capabilities.join(', ')}\n`;
    });
    contextBlock += `\nYou can use desktop_* tools to interact with the user's local machine. The user's device is connected and ready.`;
  }
}
```

This is additive — it only adds context when devices are online. No existing logic changes.

### 6.2 Agent System Prompt Enhancement

The agent already has tools registered. When it sees `desktop_*` tools in its tool list AND knows devices are online, it will naturally use them when the user asks for local machine operations.

No forced routing — the LLM decides based on context.

---

## Phase 7: Build & Package

### 7.1 Electron Builder

**`apps/desktop/electron-builder.yml`**:
- NSIS installer for Windows
- DMG for macOS
- AppImage for Linux
- Auto-update support (future)
- Code signing (future)

### 7.2 Root Package.json

**Modify:** `package.json` — Add workspace + scripts (additive):
```json
"workspaces": ["apps/*", "packages/*"],
"scripts": {
  "build:desktop": "npm run build --workspace=apps/desktop",
  "dev:desktop": "npm run dev --workspace=apps/desktop",
  "package:desktop": "npm run package --workspace=apps/desktop"
}
```

### 7.3 tsconfig

**New file:** `apps/desktop/tsconfig.json` — extends base, includes renderer types

---

## Phase 8: Testing

### 8.1 Unit Tests

**New files:**
- `packages/database/src/desktopDevices.test.ts` — DB repository tests
- `packages/websocket/src/desktop-bridge.test.ts` — Bridge connection, command dispatch, timeout tests
- `apps/core/src/desktop-tools.test.ts` — Tool registration, no-device fallback, command validation

### 8.2 Integration Tests

- Desktop bridge WS connection + auth + command round-trip
- Tool execution via bridge (mocked WS)
- Telegram context injection when device online

### 8.3 E2E Tests (Manual)

- Start Titan Server → Start Desktop App → Send command from Telegram → Verify execution
- File operations (read, write, list, delete)
- Screenshot capture + send to Titan
- App open/close
- System info
- Multi-device (two desktop clients, same user)

---

## Safety Checklist (Golden Rule)

- [ ] No existing file is modified in a breaking way
- [ ] All new env vars have defaults (app works without them)
- [ ] Desktop bridge is disabled by default if `DESKTOP_BRIDGE_ENABLED=false`
- [ ] All desktop tools return graceful error if no device connected
- [ ] Command validation (forbidden patterns) applies to desktop commands
- [ ] All new DB migrations are `CREATE TABLE IF NOT EXISTS`
- [ ] All new exports are additive (no removing/reordering existing exports)
- [ ] TypeScript strict mode passes
- [ ] All existing tests still pass
- [ ] New tests cover bridge, tools, and DB repository
- [ ] Electron app is a separate workspace (no impact on core build)
- [ ] No new runtime dependencies on server-side packages (bridge uses existing `ws`)

---

## File Summary

### New Files (Server)

| File | Purpose |
|------|---------|
| `packages/database/src/migrations/011_desktop_devices.sql` | DB migration |
| `packages/database/src/desktopDevices.ts` | Device repository |
| `packages/database/src/desktopDevices.test.ts` | Repository tests |
| `packages/websocket/src/desktop-bridge.ts` | Bridge manager class |
| `packages/websocket/src/desktop-bridge.test.ts` | Bridge tests |
| `apps/core/src/routes/desktop-bridge-rpc.ts` | RPC method registration |
| `apps/core/src/desktop-bridge-instance.ts` | Bridge singleton accessor |
| `apps/core/src/desktop-tools.ts` | Agent tool implementations |
| `apps/core/src/desktop-tools.test.ts` | Tool tests |

### Modified Files (Server — Additive Only)

| File | Change |
|------|--------|
| `packages/config/src/index.ts` | +4 env vars (all with defaults) |
| `packages/database/src/index.ts` | +1 export line |
| `packages/websocket/src/index.ts` | +1 export line |
| `apps/core/src/index.ts` | +3 lines (import, register RPC, attach bridge) |
| `apps/core/src/queue-bootstrap.ts` | +2 lines (import + register desktop tools) |
| `apps/core/src/routes/telegram.ts` | +~10 lines (inject device context, additive) |
| `package.json` | +3 scripts, workspace already covers `apps/*` |

### New Files (Desktop App — entire `apps/desktop/` directory)

~30 files for the Electron app (main process, preload, renderer, components, configs)

---

## Execution Order

| Step | Phase | Estimated Effort | Depends On |
|------|-------|-----------------|------------|
| 1 | DB migration + repository | Small | — |
| 2 | Desktop Bridge class | Medium | Step 1 |
| 3 | WS RPC methods + integration | Small | Step 2 |
| 4 | Desktop tools | Medium | Step 3 |
| 5 | Tool registration | Small | Step 4 |
| 6 | Telegram context injection | Small | Step 4 |
| 7 | Electron app scaffold | Medium | Steps 1-6 |
| 8 | Chat UI | Medium | Step 7 |
| 9 | File Explorer | Medium | Step 7 |
| 10 | Terminal | Medium | Step 7 |
| 11 | Screenshot Viewer | Small | Step 7 |
| 12 | Settings + Device Manager | Small | Step 7 |
| 13 | System tray | Small | Step 7 |
| 14 | Tests | Medium | All above |
| 15 | Typecheck + lint | Small | All above |
| 16 | README update | Small | All above |
| 17 | Git commit + push | Small | All above |

---

## Non-Goals (Out of Scope for Now)

- Mobile app (iOS/Android)
- Browser extension
- Desktop-to-desktop file sync
- Remote desktop control (VNC-style screen sharing)
- Voice commands
- Auto-update mechanism for the Electron app
- Code signing for distribution
- Multi-user desktop sharing (one device = one user)

These can be future phases after the core desktop agent is stable.
