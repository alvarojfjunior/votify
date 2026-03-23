# AGENTS.md - Agentic Coding Guidelines for Votify

Votify is a real-time group voting web application built with Next.js 14, React 18, and Socket.io. This file provides guidelines for agentic coding tools operating in this repository.

## Project Commands

```bash
# Development
npm run dev          # Start development server (localhost:3000)

# Build
npm run build        # Production build
npm run start        # Start production server

# Type checking (no lint/test commands configured)
npx tsc --noEmit     # Run TypeScript type checking
```

## Project Structure

```
votify/
├── components/      # React components
├── lib/            # Shared utilities (socket client)
├── pages/          # Next.js pages (uses pages router, not app router)
│   └── api/        # API routes
├── styles/         # Global CSS
└── package.json    # Dependencies and scripts
```

## Code Style Guidelines

### TypeScript
- Use explicit type annotations for function parameters and return types when types are not obvious
- Use interfaces for structured data types (e.g., `RoomState`, `Participant`, `Issue`, `Room`)
- Prefer `any` sparingly - use it only when type information is genuinely unavailable
- TypeScript strict mode is disabled in `tsconfig.json` - do not enable it
- Use `type` for unions, intersections, and primitive types
- Use `any` for socket event payloads where the structure varies

### File Organization
- **Components**: `components/` - React components (e.g., `VotePanel.tsx`, `ParticipantsList.tsx`)
- **Pages**: `pages/` - Next.js pages using the pages router
- **API**: `pages/api/` - API routes (e.g., `socket.ts` for Socket.io server)
- **Utilities**: `lib/` - Shared utilities (e.g., `socket.ts` for client)
- **Styles**: `styles/globals.css` - Global CSS (no CSS modules)

### Naming Conventions
- **Files**: PascalCase (e.g., `VotePanel.tsx`, `socket.ts`)
- **Components**: PascalCase (e.g., `VotePanel`, `ParticipantsList`)
- **Functions**: camelCase (e.g., `getSocket`, `connectIfNeeded`, `ensureSocketServer`)
- **Interfaces/Types**: PascalCase with descriptive names (e.g., `RoomState`, `Participant`, `Issue`, `Room`)
- **Variables**: camelCase (e.g., `roomId`, `hostName`, `currentIssue`)

### React Patterns
- Use functional components with hooks
- Use inline types for simple component props
- Prefer `useState` and `useEffect` from React
- Use `useMemo` for expensive computations (e.g., building invite links)
- Use `useRef` for values that persist across renders without causing re-renders (e.g., tracking previous issue IDs)
- Use `useEffect` return functions for cleanup (e.g., socket event listeners)

### Imports
- Group imports in this order:
  1. External libraries (React, Next.js, socket.io-client)
  2. Internal modules (lib, components)
- Use relative imports for internal modules (e.g., `../../lib/socket`, `../../components/VotePanel`)
- Avoid default exports when named exports are more descriptive

### Error Handling
- Display errors inline in the UI with red text (`color: "#ef4444"`)
- Use try-catch only when recovery is possible
- Let errors propagate naturally from async operations
- Display user-facing error messages in Portuguese (e.g., "Falha ao criar sala")

### CSS/Styling
- Use utility classes from `styles/globals.css` (e.g., `.btn`, `.card`, `.row`, `.col`, `.pill`, `.input`)
- Use inline `style` prop for dynamic styles only (e.g., `style={{ width: ... }}`)
- CSS variables are defined in `:root`:
  - `--bg`: Background color
  - `--panel`: Panel background
  - `--accent`: Primary accent color (purple)
  - `--accent-2`: Secondary accent color (green)
  - `--text`: Text color
  - `--muted`: Muted text color
  - `--danger`: Danger/error color (red)

### Socket.io Patterns
- Always call `ensureSocketServer()` on component mount to initialize the Socket.io server
- Use callbacks with socket emissions for responses: `socket.emit('event', data, (res) => {})`
- Listen to room state updates with `onRoomState` / `offRoomState`
- Use `getSocket()` to access the shared socket instance
- Remember to clean up listeners in `useEffect` return function

### API Routes
- Use Next.js API route handler signature: `export default function handler(req, res)`
- Socket.io callbacks are optional (`cb?.()` pattern)
- Use `res.end()` after setting up Socket.io to prevent double-response
- Store room state in global scope for persistence across requests

### State Management
- Room state is managed server-side via Socket.io events
- Client uses local state (`useState`) for UI state (forms, selections)
- Use refs (`useRef`) to track values that change but should not trigger re-renders

### General Guidelines
- No comments unless explaining complex business logic
- Keep files under 400 lines; split larger components if needed
- Avoid premature abstraction - add complexity only when needed
- Portuguese is used in UI strings - maintain consistency with existing text
- Use meaningful variable names that describe their purpose
- Extract complex logic into separate functions within the same file when appropriate

### Common Patterns

#### Creating a Room
```typescript
const s = getSocket();
s.emit("create_room", { hostName: name }, (res) => {
  if (res.ok) {
    router.push(`/room/${res.roomId}?host=1`);
  }
});
```

#### Joining a Room
```typescript
s.emit("join_room", { roomId, name }, (res) => {
  if (res.ok) {
    setJoined(true);
    setState(res.state);
  }
});
```

#### Listening to Room State
```typescript
useEffect(() => {
  ensureSocketServer();
  const s = connectIfNeeded();
  const handler = (payload: RoomState) => setState(payload);
  onRoomState(handler);
  return () => {
    offRoomState(handler);
  };
}, [roomId]);
```

### Testing
- No test framework is currently configured
- If adding tests, consider using Jest or React Testing Library
- Test files should be placed alongside components with `.test.tsx` or `.spec.tsx` extension