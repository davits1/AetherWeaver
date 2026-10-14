You are working on an existing personal web app called AetherWeaver (a Character.AI-style roleplay frontend). Project files: index.html, manifest.webmanifest, sw.js, icon.svg, proxy.mjs, INTEGRATION.md. Read INTEGRATION.md fully before touching anything: it defines the data shapes, the API contract, and which parts of the code must not be modified.

GOAL (this task only)
Make text generation work against the NovelAI API with real streaming, through a hardened local proxy. Do NOT implement image generation, local-LLM support, or an IndexedDB migration yet. Keep the Mock provider working.

RULES
- Modify only: `API.generateReply`, `API.suggestReplies`, the provider fields in the Settings screen (minimal wiring), default values in the settings object, `proxy.mjs`, and `sw.js`. Do not touch other rendering functions, CSS, or data shapes.
- No new dependencies. Plain Node (ESM) for the proxy, vanilla JS in the browser.
- Do NOT guess endpoints, model IDs, request fields, or response formats beyond what the reference files state or what a real test call proves. If something is uncertain, leave a clearly marked TODO and report it at the end.

REFERENCE MATERIAL (attached)
- api_guidelines.md: the working reference for NovelAI request formats. Use section 1 (text) only. IGNORE sections 3 and 4 (Telegram); they are unrelated to this project. Section 2 (images) will be used in a later task: do not implement it now.
- NovelAI_Text_Generation_Documentation.md: product-level documentation. Use it only for behavior (Memory / Author's Note / Lorebook semantics, context size). It contains no API specification.

TEXT API FACTS TO IMPLEMENT (from api_guidelines.md, section 1)
- POST https://text.novelai.net/oa/v1/completions with header "Authorization: Bearer <token>" and a JSON body shaped like the guide's payload example.
- settings.provider.model: dropdown with "glm-4-6" and "xialong-v1" (default "xialong-v1").
- The prompt is a plain script-style string, NOT a chat template: lines of "SpeakerName: text", ending with "<character name>:" so the model continues as the character. Use the persona's name as the user's speaker label. Stop sequences: ["\n<persona name>:", "\nUSER:", "\nUser:"] plus any the user configured, with {{user}} and {{char}} replaced.
- Map Settings to payload fields: temperature, top_p, top_k, min_p, max_tokens, repetition_penalty, stop. Send these fixed fields with the guide's example values: min_length 1, top_a 1.0, typical_p 1.0, tail_free_sampling 1.0, repetition_penalty_range 2048, repetition_penalty_slope 0, repetition_penalty_frequency 0, repetition_penalty_presence 0.05.
- Update the default advancedText values to the guide's example values: temperature 1.4, topP 0.938, topK 60, minP 0.024, repetitionPenalty 1.04, maxTokens 220 (chat-sized replies).
- Context budget: settings.provider.contextTokens, default 28672 (the guide mentions up to 36864; keep the safer value).
- Streaming: the guide only shows "stream": false and does not document streaming. First try "stream": true, expecting OpenAI-style SSE ("data: {json}" lines with the text in choices[0].text, ending with "data: [DONE]"). If the API rejects it or the format differs, fall back to a non-streaming request and simulate streaming by feeding the final text to onToken in small chunks. Stop must work in both modes.
- It is an untuned instruct-style model: support settings.advancedText.systemPromptOverride and add an optional "prefill" text field (appended at the very end of the prompt to steer the start of the reply).

TESTING WITH THE NOVELAI MCP SERVER
You have access to the NovelAI text and image APIs through an MCP server. Use it to verify assumptions BEFORE writing the integration code.
1. Read the MCP tool descriptions/docstrings first: they are another reference for parameter names and accepted values. If they contradict api_guidelines.md, trust what a real call proves and tell the user about the discrepancy.
2. Make one small real call to the text completions endpoint (low max_tokens, e.g. 30) using the guide's payload shape with model "xialong-v1" and confirm: the exact response structure (where the generated text lives), which fields are accepted or rejected, and how stop sequences behave.
3. Check whether "stream": true is supported. If the MCP tool cannot stream (it likely returns full responses only), say so and verify streaming later through the local proxy once the user has set NOVELAI_TOKEN, or give the user a single curl command to run and paste the output back.
4. Do NOT use the MCP for image generation in this task (it consumes the user's Anlas).
5. The MCP does NOT test browser-side behavior. After the code is written, test the proxy end to end yourself (e.g. a Node script that POSTs to the local proxy route and prints the streamed chunks), and list what could only be tested manually in the browser.
6. Keep tests cheap and minimal. Never print, log, or commit the API token, and never write it into any project file other than a git-ignored .env.

TASKS
1. Rewrite proxy.mjs as a small zero-dependency Node server that:
   - Serves the app's static files (so the app and the proxy share one origin and no CORS is needed).
   - Exposes fixed routes under /proxy/ that forward only to an allowlist of hosts (text.novelai.net, image.novelai.net, api.novelai.net, plus an optional LOCAL_LLM_URL from env). Reject everything else with 403.
   - Reads NOVELAI_TOKEN from an environment variable or a local .env file and injects the Authorization header server-side. The browser must never need to know the token (a token typed into Settings may optionally override it).
   - STREAMS upstream responses to the client chunk by chunk (no buffering), preserves the SSE content-type, aborts the upstream request when the client disconnects, and forwards the client's Accept header unchanged (the image endpoint depends on it in the next task).
   - Wraps all handlers in try/catch and returns a JSON error with a 502 status instead of crashing.
   - Binds to HOST (default 127.0.0.1) and PORT (default 8787) from env; document how to bind to a Tailscale or LAN address for phone access.
2. Implement `API.generateReply` for provider.type === "novelai":
   - Build the prompt in the order described in INTEGRATION.md, section 4 (preamble, Memory, triggered Lorebook entries, character + persona, history, Author's Note at depth, optional prefill). Replace {{char}} and {{user}} everywhere.
   - Add a token budget using an approximate token counter: reserve space for max_tokens, never drop Memory, the character definition, or the Author's Note, and drop the oldest history first.
   - Parse the response incrementally, call onToken(chunk) for each delta, support `continueFrom`, and return the full final text.
   - Respect the AbortSignal (throw a DOMException named AbortError, preserving partial text) and throw descriptive Errors for 401/403/429/5xx so the existing toast shows a useful message.
   - If localStorage.debugPrompt === "1", console.log the final assembled prompt and parameters so the user can inspect them.
3. `API.suggestReplies`: for the NovelAI provider, return an empty array (no extra generation calls).
4. Settings: make the provider fields work for NovelAI (model, proxy base path defaulting to "/proxy", contextTokens, optional token override, prefill). Keep the section clean.
5. sw.js: use network-first for index.html and other app files, never cache /proxy/ requests, and bump the cache version.
6. If the default stop sequences in the settings object contain a literal backslash-n instead of a real newline, fix them.

DELIVERABLE
Updated files, a short "how to run" (env vars, command, how to open the app from a phone), and a manual test checklist (streaming, Stop mid-stream, Continue, swipe/regenerate, Lorebook trigger, wrong-token error). In the final report, separate three things clearly: (a) confirmed with a real call, (b) assumed but unverified, (c) only testable manually in the browser.