# API Connection Guidelines for AI Bots

This report provides comprehensive details on how to connect to and utilize the **NovelAI API** (specifically for the **GLM-4.6** model) and the **Telegram Bot API**. It is intended to serve as a knowledge base for AI models or developers creating bots.

---

## 1. NovelAI Text Generation API (GLM-4.6)

NovelAI hosts the **GLM-4.6** and **Xialong-v1" model, providing a highly capable, large-context open weights model accessible via their API.

### 1.1 Connection Details
The bot currently serves this model via NovelAI's **OpenAI-Compatible Completion Endpoint**, which allows for granular control over generation parameters while using a standard structure.

*   **Base URL**: `https://text.novelai.net/oa/v1/completions`
*   **Method**: `POST`
*   **Authentication**:
    *   Header: `Authorization: Bearer <YOUR_NOVELAI_API_TOKEN>`
    *   *Note*: The token must be a persistent API token found in Account Settings.

### 1.2 Payload Structure
Although utilizing the OpenAI logic structure (`oa/v1`), NovelAI allows passing its robust sampler suite in the payload.

```json
{
  "model": "glm-4-6",
  "prompt": "The story so far...\nUSER: Hello!\nNatasha:",
  "max_tokens": 512,
  "temperature": 1.4,
  "min_length": 1,
  "top_p": 0.938,
  "top_k": 60,
  "top_a": 1.0,
  "typical_p": 1.0,
  "tail_free_sampling": 1.0,
  "repetition_penalty": 1.04,
  "repetition_penalty_range": 2048,
  "repetition_penalty_slope": 0,
  "repetition_penalty_frequency": 0,
  "repetition_penalty_presence": 0.05,
  "min_p": 0.024,
  "stop": ["\nUSER:", "\nUser:", "\n[System Note:"],
  "stream": false
}
```

Note: the "model" field supports 2 models: `glm-4-6` or `xialong-v1`. Xialong is a fine-tuned version of GLM-4.6, specialized on storytelling, but still following the instruction format.

### 1.3 Key Parameters Explained
*   **model**: Must be set to `"glm-4-6"` (or as updated by NovelAI).
*   **prompt**: The full context string. GLM-4.6 on NovelAI supports a context window up to **36,864 tokens** (approx 112k+ characters), allowing for extensive chat history.
*   **temperature**: GLM-4.6 handles higher temperatures well (e.g., `1.4`) for creative output without losing coherence.
*   **stop**: A list of strings where generation should strictly terminate. Essential for chat interfaces to prevent the bot from speaking for the user.
*   **repetition_penalty**: Keeps the model from looping. A low value like `1.04` is usually sufficient for GLM-4.6.

---

## 2. NovelAI Image Generation API (V5 - NAI Diffusion V5 Full)

For state-of-the-art anime generation, use the **`nai-diffusion-5-full`** model. NAI Diffusion V5 introduces a major architectural paradigm shift: **it is trained primarily on natural language prose rather than Danbooru tag lists**, and utilizes top-level scene inputs alongside modern character conditioning arrays (`characterPrompts`).

### 2.1 Connection Details
*   **Base URL**: `https://image.novelai.net/ai/generate-image`
*   **Method**: `POST`
*   **Authentication**:
    *   Header: `Authorization: Bearer <YOUR_NOVELAI_API_TOKEN>`
    *   Header: `Content-Type: application/json`
    *   *Note*: Omitting `Accept: application/json` causes NovelAI to return a ZIP archive containing the generated PNG image directly.

### 2.2 V5 Prompting Paradigm (Natural Language Prose)
Unlike earlier models (V1–V3 and early V4) that relied almost exclusively on comma-separated Danbooru keyword soup, **V5's text encoder leverages full-context cross-attention over natural language**:

1.  **Grammatical Binding**:
    *   *Tags*: `"heterochromia, brown eyes, blue eyes"` floats three independent concepts into the model; the model may flip a coin on which eye gets which color.
    *   *Prose*: `"Her right eye is brown, and her left eye is blue-gray"` grammatically attaches each color to a specific feature with consistent spatial reliability.
2.  **Spatial Relations, Scoping & Causality**:
    *   Use flowing prose to describe subject, pose, expression, clothing, lighting angles (*"backlit by warm afternoon sunlight"*), and character-environment interaction (*"rain running down the glass behind her"*).
3.  **Lexicalized Compound Tags (The Exception)**:
    *   Certain Danbooru tag combos were learned as fused, single concepts (e.g. `thigh gap`, `eyepatch bikini`, `dutch angle`). Keep these as literal bare tags inside sentences rather than deconstructing them into descriptive prose (which risks separating them into unrelated components).
4.  **Avoid Semantic Ambiguity**:
    *   V5 decodes phrasing faithfully without "auto-correcting". Be explicit: prefer `"in the visual style of an oil painting"` over ambiguous terms like `"painting-like"`.
5.  **Emphasis Syntax**:
    *   `{term}` strengthens attention (e.g., `{sharp focus}`).
    *   `[term]` weakens attention (e.g., `[background clutter]`).
    *   Use sparingly on short phrases or words, never on entire paragraphs.
6.  **Speech Bubbles, Quoted Text & Comics**:
    *   When quotes (`"..."`) are present in character prompts, V5 can render English text inside dialogue bubbles.
    *   Place the dialogue line inside the specific character's prompt (e.g. `There's a speech bubble next to the girl that says "Hello!"`), **never** in the base scene prompt.
    *   For multi-panel comics, declare the panel count first in the base prompt (*"There are three comic panels. The first panel shows..."*), and specify dialogue in the respective character prompts.

### 2.3 Payload Architecture & Parameters
*   **`input` (Root level)**: NovelAI V5 reads the base scene prompt (environment, mood, art style, lighting) from the top-level `"input"` field, **not** inside `parameters.prompt`. Exclude character descriptions from `input` so characters are not duplicated upon importing the image into the NovelAI web UI.
*   **`parameters.params_version`**: Must be `4`.
*   **`parameters.qualityToggle`**: **Always set to `false`**. When `true`, NovelAI's servers forcibly append `", no text, best quality, very aesthetic, absurdres"` at the end, which unconditionally breaks speech bubbles and dialogue requests. Set it to `false` and manage your own suffix:
    *   If dialogue/quotes are present: append `, speech bubble, border, english text` to the base prompt.
    *   If no dialogue: append `, no text` to the base prompt.
*   **`parameters.characterPrompts`**: Modern array for per-character conditioning. Supports up to 3 characters before visual coherence degrades. Each entry defines:
    *   `prompt`: Prose description of character appearance, clothing, pose, emotion, and optional dialogue.
    *   `uc`: Undesired content specific to this character (typically empty `""`).
    *   `center`: Coordinate anchor, e.g. `{"x": 0, "y": 0}`.
    *   `enabled`: `true`.
*   **`parameters.v4_prompt` & `parameters.v4_negative_prompt`**: Kept alongside `characterPrompts` for dual-compatibility with the backend conditioning pipeline.
*   **Resolutions**: Multiples of 64. Standard presets:
    *   Portrait (default for single characters): `832` x `1216`
    *   Landscape (wide scenes/environments): `1216` x `832`
    *   Square: `1024` x `1024`

### 2.4 Payload Structure (V5 Full)

```json
{
  "model": "nai-diffusion-5-full",
  "action": "generate",
  "input": "An indoor bedroom scene in a digital art style, solo focus on the character, warm cinematic lighting, no text",
  "parameters": {
    "params_version": 4,
    "width": 832,
    "height": 1216,
    "steps": 23,
    "scale": 5.0,
    "sampler": "k_euler_ancestral",
    "seed": 2847193852,
    "n_samples": 1,
    "noise_schedule": "karras",
    "qualityToggle": false,
    "characterPrompts": [
      {
        "prompt": "An adult girl with long blonde hair and blue eyes, medium breasts, wearing a cozy oversized knit sweater, smiling warmly at the viewer.",
        "uc": "",
        "center": { "x": 0, "y": 0 },
        "enabled": true
      }
    ],
    "negative_prompt": "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy",
    "v4_prompt": {
      "caption": {
        "base_caption": "An indoor bedroom scene in a digital art style, solo focus on the character, warm cinematic lighting, no text",
        "char_captions": [
          {
            "char_caption": "An adult girl with long blonde hair and blue eyes, medium breasts, wearing a cozy oversized knit sweater, smiling warmly at the viewer.",
            "centers": [{ "x": 0, "y": 0 }]
          }
        ]
      },
      "use_coords": false,
      "use_order": true
    },
    "v4_negative_prompt": {
      "caption": {
        "base_caption": "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy",
        "char_captions": []
      },
      "use_coords": false,
      "use_order": false
    }
  }
}
```

### 2.5 Multi-Panel Comic / Dialogue Example Payload

When generating comics with speech bubbles, place panel instructions in `input` and dialogue in `characterPrompts`:

```json
{
  "model": "nai-diffusion-5-full",
  "action": "generate",
  "input": "There are two comic panels. The first panel shows a boy and a girl talking in a cafe. The second panel shows a close-up of the girl reacting with surprise, speech bubble, border, english text",
  "parameters": {
    "params_version": 4,
    "width": 1216,
    "height": 832,
    "steps": 23,
    "scale": 5.0,
    "sampler": "k_euler_ancestral",
    "seed": 1409284721,
    "n_samples": 1,
    "noise_schedule": "karras",
    "qualityToggle": false,
    "characterPrompts": [
      {
        "prompt": "boy, short silver hair, green eyes, casual jacket, sitting at a cafe table. There's a speech bubble next to the boy that says \"Did you hear what happened?\"",
        "uc": "",
        "center": { "x": 0, "y": 0 },
        "enabled": true
      },
      {
        "prompt": "girl, long crimson hair, amber eyes, surprised expression, holding a coffee cup. There's a speech bubble next to the girl that says \"Wait, really?!\"",
        "uc": "",
        "center": { "x": 0, "y": 0 },
        "enabled": true
      }
    ],
    "negative_prompt": "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, bad anatomy",
    "v4_prompt": {
      "caption": {
        "base_caption": "There are two comic panels. The first panel shows a boy and a girl talking in a cafe. The second panel shows a close-up of the girl reacting with surprise, speech bubble, border, english text",
        "char_captions": [
          {
            "char_caption": "boy, short silver hair, green eyes, casual jacket, sitting at a cafe table. There's a speech bubble next to the boy that says \"Did you hear what happened?\"",
            "centers": [{ "x": 0, "y": 0 }]
          },
          {
            "char_caption": "girl, long crimson hair, amber eyes, surprised expression, holding a coffee cup. There's a speech bubble next to the girl that says \"Wait, really?!\"",
            "centers": [{ "x": 0, "y": 0 }]
          }
        ]
      },
      "use_coords": false,
      "use_order": true
    },
    "v4_negative_prompt": {
      "caption": {
        "base_caption": "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, bad anatomy",
        "char_captions": []
      },
      "use_coords": false,
      "use_order": false
    }
  }
}
```

### 2.6 Response Processing (In-Memory ZIP Extraction)
NovelAI returns a binary ZIP archive containing the generated image(s) as `.png` files. You can extract it directly in memory without writing temporary files to disk:

```python
import io
import zipfile
import httpx

def extract_image_bytes(response_content: bytes) -> bytes:
    with zipfile.ZipFile(io.BytesIO(response_content)) as zf:
        # Get the first PNG inside the archive
        png_names = [name for name in zf.namelist() if name.endswith(".png")]
        if not png_names:
            raise RuntimeError("No PNG image found in NovelAI response ZIP archive.")
        return zf.read(png_names[0])
```

---

## 3. Telegram Bot API

For Python-based bots, the `python-telegram-bot` library is the industry standard wrapper for the Telegram HTTP API.

### 3.1 Setup (BotFather)
1.  Message **@BotFather** on Telegram.
2.  Use `/newbot` to create a bot and get the **API Token**.

### 3.2 Python Library Usage (`python-telegram-bot`)
Modern implementations use the `async`/`await` pattern with `ApplicationBuilder`.

**Basic Boilerplate:**
```python
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Hello! I am online.")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text
    # Call LLM here
    await update.message.reply_text(f"You said: {user_text}")

def main():
    app = Application.builder().token("YOUR_TOKEN").build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling()
```

### 3.3 Best Practices for AI Bots
*   **Typing Indicators**: LLMs take time to generate. Use `send_chat_action` to show "Typing..." or "Uploading photo..." status.
    ```python
    from telegram.constants import ChatAction
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    ```
*   **Long Messages**: Telegram checks for a 4096 character limit. Split long AI responses into multiple messages if necessary.
*   **Sending Images**:
    *   Send images directly from memory (BytesIO) to avoid saving to disk.
    ```python
    import io
    # image_bytes from NovelAI
    await context.bot.send_photo(chat_id=chat_id, photo=io.BytesIO(image_bytes))
    ```
*   **Privacy**: Bots only see messages mentioning them or in private chats depending on "Privacy Mode" settings in BotFather. For full access in groups, disable Privacy Mode.

---

## 4. Integration Logic (The "Brain")

When combining these APIs:
1.  **Receive** message via Telegram.
2.  **Append** message to a history string/list.
3.  **Construct Prompt**: Format the history as a script (e.g., `USER: Hello\nAI: Hi there`).
4.  **Send to NovelAI Text API**.
5.  **Clean Response**: Remove any generated "USER:" lines (hallucinations).
6.  *(Optional)* Extract image prompts (e.g., `[generated image of a cat]`) and call **NovelAI Image API**.
7.  **Reply** to user on Telegram.
