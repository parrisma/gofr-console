# GOFR-Console: Step-by-Step Implementation Plan

**Goal**: Basic UI shell with navigation, layout, and stub API calls.
**Estimated Steps**: 12 phases (~1-2 hours each for a solo developer)

---

## Phase 1: Project Initialization ✅

**Outcome**: Empty Vite + React + TypeScript project running on port 3000.

```bash
# Inside container
pnpm create vite@latest . --template react-ts
pnpm install
pnpm dev
```

**Verify**: Browser shows default Vite page at `http://localhost:3000`.

**Status**: ✅ Complete - Vite project created, dependencies installed, security scan passed.

---

## Phase 2: Install Core Dependencies ✅

**Outcome**: MUI and routing libraries installed.

```bash
pnpm add @mui/material @mui/icons-material @emotion/react @emotion/styled
pnpm add react-router-dom
```

**Files touched**: `package.json` only.

**Status**: ✅ Complete - MUI and React Router installed.

---

## Phase 3: Create Folder Structure ✅

**Outcome**: Organized source directory.

```
src/
├── components/
│   ├── layout/          # AppBar, NavDrawer, AssistantPanel
│   └── common/          # Buttons, Cards, StatusBadge
├── pages/
│   ├── Dashboard.tsx
│   ├── Intelligence.tsx
│   ├── Analysis.tsx
│   ├── Operations.tsx
│   └── Library.tsx
├── hooks/
├── services/
│   └── api/             # Stub MCP clients
├── theme/
│   └── index.ts         # MUI theme config
├── types/
│   └── index.ts         # Shared TypeScript interfaces
├── App.tsx
└── main.tsx
```

**Action**: Create empty placeholder files (`// TODO`) for each.

**Status**: ✅ Complete - Folder structure and placeholder files created.

---

## Phase 4: Configure MUI Dark Theme ✅

**Outcome**: App renders with GOFR color palette.

**File**: `src/theme/index.ts`

```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#121212', paper: '#1E1E1E' },
    primary: { main: '#00E5FF' },
    secondary: { main: '#7C4DFF' },
    success: { main: '#00C853' },
    error: { main: '#FF1744' },
  },
});
```

**File**: `src/main.tsx`

```typescript
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
// Wrap <App /> with <ThemeProvider theme={theme}><CssBaseline />...
```

**Verify**: App has dark background.

**Status**: ✅ Complete - MUI dark theme configured and applied.

---

## Phase 5: Build Root Layout Shell ✅

**Outcome**: AppBar + Left Drawer (collapsed) + Main Content area visible.

**File**: `src/components/layout/AppShell.tsx`

- Use MUI `Box` with `display: flex`.
- Add placeholder `<AppBar>` with title "GOFR Console".
- Add placeholder `<Drawer variant="permanent">` with 5 icon buttons.
- Add `<Box component="main">` for routed content.

**File**: `src/App.tsx`

- Import `AppShell` and render `<Outlet />` inside main area.

**Verify**: Static layout visible; clicking icons does nothing yet.

**Status**: ✅ Complete - AppBar, Drawer, and main content area created.

---

## Phase 6: Add React Router Navigation ✅

**Outcome**: Clicking nav icons changes the main content area.

**File**: `src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// Define routes:
// /           -> Dashboard
// /intelligence -> Intelligence
// /analysis   -> Analysis
// /operations -> Operations
// /library    -> Library
```

**File**: `src/components/layout/NavDrawer.tsx`

- Use `useNavigate()` hook.
- Map icons to paths: Dashboard, Lightbulb, BarChart, Build, Folder.

**Verify**: URL changes and placeholder page text updates.

**Status**: ✅ Complete - React Router configured, navigation working, all pages created with placeholders.

---

## Phase 7: Create Stub API Service Layer ✅

**Outcome**: Mock functions that return fake data (no network calls).

**File**: `src/services/api/stub.ts`

```typescript
// Simulates MCP tool responses
export const stubApi = {
  // GOFR-IQ
  listClients: async () => ({
    clients: [
      { guid: 'c1', name: 'Acme Fund', client_type: 'INSTITUTIONAL' },
      { guid: 'c2', name: 'Jane Doe', client_type: 'RETAIL' },
    ],
  }),
  getClientFeed: async (guid: string) => ({
    articles: [
      { title: 'Fed Raises Rates', impact_score: 85, ticker: 'SPY' },
    ],
  }),
  // GOFR-NP
  healthCheck: async () => ({ status: 'ok', neo4j: 'up', chromadb: 'up' }),
};
```

**File**: `src/services/api/index.ts`

- Re-export `stubApi` as `api` for now.
- Later, swap to real HTTP client.

**Status**: ✅ Complete - Stub API service layer created with mock data.

---

## Phase 8: Build Dashboard Page with Status Cards ✅

**Outcome**: Dashboard shows connection status widgets (all green, stubbed).

**File**: `src/pages/Dashboard.tsx`

- Call `api.healthCheck()` in `useEffect`.
- Render 5 `Card` components (one per GOFR service).
- Show green `CheckCircle` icon for each.

**Verify**: Dashboard displays "IQ: Online", "DIG: Online", etc.

**Status**: ✅ Complete - Dashboard page displays 5 service status cards with health check integration.

---

## Phase 9: Build Intelligence Page with Client List ✅

**Outcome**: Table of clients rendered from stub data.

**File**: `src/pages/Intelligence.tsx`

- Call `api.listClients()` on mount.
- Render `Table` or `DataGrid` (basic MUI Table is fine for stub).
- Columns: Name, Type, Actions (placeholder button).

**Verify**: Two rows of mock client data appear.

**Status**: ✅ Complete - Intelligence page displays client list table with Name, Type, and Actions columns.

---

## Phase 10: Add Assistant Panel (Right Drawer) ⏸️

**Status**: ⏸️ Parked - Assistant panel deferred for later implementation.

**Outcome**: Collapsible right drawer with a chat input box.

**File**: `src/components/layout/AssistantPanel.tsx`

- `Drawer` anchored to right, `variant="persistent"`.
- Contains:
  - Header: "GOFR Assistant" + collapse button.
  - Message list (empty `Box` for now).
  - Input: `TextField` + Send `IconButton`.

**File**: `src/components/layout/AppShell.tsx`

- Add state `assistantOpen: boolean`.
- Toggle button in `AppBar`.

**Verify**: Clicking toggle opens/closes right panel; input is visible.

---

## Phase 11: Wire Up Basic Chat State ⏸️

**Status**: ⏸️ Parked - Chat state management deferred for later implementation.

**Outcome**: Typing a message and pressing Enter adds it to the list.

**File**: `src/components/layout/AssistantPanel.tsx`

```typescript
const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
const [input, setInput] = useState('');

const handleSend = () => {
  if (!input.trim()) return;
  setMessages((prev) => [...prev, { role: 'user', content: input }]);
  // Stub: echo back after 500ms
  setTimeout(() => {
    setMessages((prev) => [...prev, { role: 'assistant', content: `You said: ${input}` }]);
  }, 500);
  setInput('');
};
```

**Verify**: Messages appear in the panel; assistant echoes back.

---

## Phase 12: Final Polish & Placeholder Pages ✅

**Outcome**: All nav items lead to styled placeholder pages.

**Files**: `src/pages/Analysis.tsx`, `Operations.tsx`, `Library.tsx`

- Each renders a `Typography` heading + "Coming Soon" message.
- Optionally add an illustrative icon.

**Verify**: Full navigation works; no 404s; consistent styling.

**Status**: ✅ Complete - All placeholder pages have centered layouts with icons and "Coming Soon" messages.

---

## Summary Checklist

| Phase | Deliverable | Key Files |
|-------|-------------|-----------|
| 1 | Vite project running | `package.json` |
| 2 | MUI installed | `package.json` |
| 3 | Folder structure | `src/*` |
| 4 | Dark theme | `theme/index.ts` |
| 5 | Layout shell | `AppShell.tsx` |
| 6 | Routing | `App.tsx`, `NavDrawer.tsx` |
| 7 | Stub API | `services/api/stub.ts` |
| 8 | Dashboard | `pages/Dashboard.tsx` |
| 9 | Client list | `pages/Intelligence.tsx` |
| 10 | Assistant drawer | `AssistantPanel.tsx` |
| 11 | Chat state | `AssistantPanel.tsx` |
| 12 | Placeholder pages | `Analysis.tsx`, etc. |

---

## What's Next (Future Phases)

- **Phase 13**: Replace stub API with real HTTP client using `fetch`.
- **Phase 14**: Integrate LLM chat completions (OpenAI/Anthropic SDK).
- **Phase 15**: Implement tool-call rendering in Assistant (Accordion states).
- **Phase 16**: Add `DataGrid Pro` for dense data views.
- **Phase 17**: Graph visualization with `react-force-graph`.
