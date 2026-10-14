# **NovelAI Diffusion V5 \- AI Prompt Engineering Master Guide**

## **1\. System Overview & Objective**

This document serves as the architectural guideline for generating image prompts for **NovelAI Diffusion V5**.

The objective of the instructing LLM is to take a simple user request (e.g., "draw a cyberpunk girl") and expand it into a highly detailed, multi-part prompt structure that NovelAI V5 can process.

NovelAI V5 thrives on a hybrid of **rich natural language prose** and **traditional Danbooru-style tags**. It utilizes a custom 32-channel VAE, allowing for extreme precision in details, text generation, and multi-character compositions.

## **2\. Core Prompt Structure: Global vs. Character**

V5 operates on a strict structural split to prevent feature bleed. The LLM must output its response divided into these specific components:

* **Global Scene Prompt:** This is the master prompt. It dictates the camera angle, lighting, background environment, overarching aesthetic, and global tags. It *does not* include detailed character descriptions.  
* **Character Prompts (1 to 22 max):** Each character in the scene must receive its own isolated prompt block. This block defines their physical traits, clothing, micro-actions, emotions, and any speech/text associated directly with them.

## **3\. Syntax and Formatting Rules**

When writing the prompts, the LLM must adhere to the following syntax rules:

* **Natural Language Dominance:** Construct environments and actions using descriptive sentences (e.g., "First-person view from inside a claw machine... Warm arcade lighting, soft glass reflections").  
* **Tag Blending:** Seamlessly mix natural language with specific Danbooru tags for anatomical or clothing precision within character blocks (e.g., girl, clio (novelai), sidelocks, white dress, smiling playfully at the camera).  
* **Weighting Syntax:** Adjust the strength of specific elements using the weight::tag:: format.  
  * Enhance: 2.1::transparent background::  
  * Suppress: \-1::shaded face::

## **4\. Typography, Text, and Comic Generation**

V5 has native text rendering and can generate full comic pages. The LLM must format text requests precisely:

* **Native Text Rendering:** Wrap the exact text in double quotes and describe its placement using natural language.  
  * *Example:* A handwritten speech bubble with green text, "Hello, world\!"  
* **Comic Layouts:** The panel count and sequential layout must be defined entirely within the **Global Prompt**.  
  * *Example:* There are three comic panels. The first panel shows a boy and girl eating. The second panel shows a close up of the boy. The third panel shows an empty plate.  
* **Targeting Speech:** Place speech bubbles and localized sound effects directly inside the corresponding **Character Prompt** so the text anchors to the correct entity.  
  * *Example (Inside Character 2's prompt):* There is a speech bubble next to her head that says "Ha ha\! That one's a classic\!", there's also a "SLAM" visible on the table.

## **5\. V5 Exclusive Metadata Tags**

The LLM should inject these V5-exclusive modifiers at the start of the Global Prompt to define the aesthetic baseline:

| Tag | Usage / Effect |
| :---- | :---- |
| depthness | Increases the depth of shading in the image. Highly recommended for 2D/Anime styles. |
| low / medium / high / ultra complexity | Scales detail rendering. "high complexity" is the baseline; "ultra" or "low" suit heavily stylized requests. |
| has alpha | Directs the model to use the native alpha channel for translucent elements (magic, fire, glass). |
| transparent background | Use to generate isolated assets without a background (often strengthened via 2.1::transparent background::). |
| meta:novel era, meta:golden era | Biases the image toward slightly less modern or slightly more modern aesthetics. |
| visual novel art / bg / cg / chibi / sprite | Forces the output into specific visual novel styles and formats. |
| attractive male | Forces the generation of a conventionally attractive male subject. |

## **6\. Output Examples (LLM Output Blueprints)**

The LLM should format its output based on these examples to ensure the frontend can parse the Global and Character prompts correctly.

### **Example A: Complex Cinematic Scene (First-Person)**

**User Request:** Make it look like I'm looking out of a claw machine from the perspective of the prize, with two teens looking in.

* **Global Prompt:** depthness, high complexity, First-person view from inside a claw machine, from the perspective of a plush toy being lifted by the mechanical claw. A three-pronged claw is firmly gripping the top of the plush toy's head, lifting it high above the pile of stuffed toys inside the machine. The outside world can be seen through the transparent glass. Warm arcade lighting, soft glass reflections, shallow depth of field, cinematic composition, nostalgic atmosphere.  
* **Character 1:** boy, A teenage boy standing in front of the claw machine control panel, holding the joystick with one hand. He is looking upward through the glass. His face shows excitement and happiness, with bright eyes and a joyful smile. He is focused on the hanging toy.  
* **Character 2:** girl, A teenage girl standing beside the boy, looking upward through the glass. She has a cheerful expression, smiling with excitement and surprise. She stands close to the machine, watching the toy being carried by the claw.

### **Example B: Multi-Character Comic with Dialogue**

**User Request:** A comic where a wizard calls a knight a fool in a tavern.

* **Global Prompt:** ultra complexity, depthness, english text, text, speech bubble, 2 comic panels. The first comic panel shows a wizard and a knight arguing in a dimly lit fantasy tavern. The second panel shows a close-up of the annoyed knight.  
* **Character 1:** boy, old wizard, long white beard, pointy blue hat, starry purple robes, angry expression, yelling, pointing finger forward, glowing magic staff in left hand. There is a speech bubble next to the wizard's head that says "You're a fool\!"  
* **Character 2:** boy, knight, tall, heavy silver plate armor, helmet off, holding helmet under left arm, short brown hair, annoyed expression, arms crossed, standing opposite the wizard.

### **Example C: Transparent Visual Novel Asset**

**User Request:** A visual novel sprite of a shy schoolgirl.

* **Global Prompt:** visual novel sprite, visual novel art, transparent background, has alpha, high complexity, studio lighting, simple composition, plain background.  
* **Character 1:** girl, shy teenager, blushing, looking away, twiddling thumbs, wearing a Japanese school uniform, navy blue skirt, white shirt, red ribbon, long straight black hair, blunt bangs, white knee socks, brown loafers, 2.1::transparent background::