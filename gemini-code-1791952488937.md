# AetherWeaver — Backend Integration Handoff Guide

This document provides the complete technical specification for replacing the client-side mock functions in `index.html` with real API calls to **NovelAI** (text & image generation) and/or a **local OpenAI-compatible LLM server** (e.g., KoboldCpp, llama.cpp, vLLM, Text Generation WebUI, Ollama).

---

## 1. Where to Edit vs. What Must NOT Be Modified

### Modify ONLY:
1. **`const API = { ... }` (Section 2 in `index.html`)**:
   - Specifically `API.generateReply`, `API.generateImage`, `API.generateAvatar`, and `API.suggestReplies`.
   - If you also move persistence to IndexedDB or a backend server later, swap the methods inside **`const Storage = { ... }` (Section 3 in `index.html`)** while keeping their return signatures identical.

### Do NOT Modify:
- Any DOM rendering functions (`renderDiscoverScreen`, `renderChatScreen`, `renderMessageRow`, etc.).
- Event delegation handlers or CSS variables.
- The structure of `Message`, `MessageAlternative`, `Chat`, or `Settings` objects. The UI relies on `message.alternatives[message.selectedIndex]` for swipe navigation, regeneration, and inline image cards.

---

## 2. Exact API Contracts

All functions live on the global `API` object (`const API = { ... }`) and return Promises.

### `API.listCharacters(query = "", category = "All")`
- **Parameters**:
  - `query` (`string`): Case-insensitive search substring matched against `name`, `tagline`, `description`, and `tags`.
  - `category` (`string`): Tag name or `"All"`.
- **Returns**: `Promise<Character[]>`
- **Error behavior**: Reject with an `Error` instance; caller displays an error toast.

### `API.getCharacter(id)`
- **Parameters**: `id` (`string`)
- **Returns**: `Promise<Character | null>`

### `API.saveCharacter(character)`
- **Parameters**: `character` (`Partial<Character>`) — if `id` is empty/falsy, generate a unique ID.
- **Returns**: `Promise<Character>` (the stored object with `id` and `updatedAt` populated).

### `API.generateReply(params)`
- **Parameters**:
  ```ts
  {
    character: Character,
    persona: Persona,
    messages: Message[],          // Full message history including the newly created empty assistant message at the end
    memory: string,               // Per-chat Memory string from the Context Drawer
    authorsNote: string,          // Per-chat Author's Note string from the Context Drawer
    lorebookEntries: LorebookEntry[], // Per-chat Lorebook array
    settings: Settings,           // Full settings object (includes simple + advancedText + provider)
    signal?: AbortSignal,         // AbortController signal wired to the Stop button
    onToken?: (chunk: string) => void, // Callback invoked for each streamed text delta
    continueFrom?: string         // Non-empty string when the user clicked "Continue" on an existing message
  }