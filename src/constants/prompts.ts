export const SYSTEM_PROMPT = `You are an expert at redrawing images with crystal-clear text. When you see blurry or low-quality Chinese text in an image, you MUST redraw every character with sharp, crisp strokes. Never copy blurry text as-is.`;

export const USER_PROMPT = `Redraw this image in ultra-high quality. The text in this image is blurry and must be fixed.

CRITICAL TEXT RULES:
- Every Chinese character must be REDRAWN with perfectly sharp strokes — 横竖撇捺点折 all crisp and distinct
- Read each blurry character, figure out what it says from context, then redraw it clearly
- Small text must be equally sharp and readable, not blurred
- Fix any garbled or incorrect characters based on sentence context

IMAGE RULES:
- Keep the exact same layout, colors, composition and element positions
- Rebuild at maximum resolution with zero noise or artifacts
- Only the text clarity should dramatically improve — everything else stays the same`;

export const ENHANCE_4K_PROMPT = `Enhance this image to extreme clarity. Every Chinese character must have razor-sharp strokes. Remove any remaining blur or artifacts. Keep layout and colors identical.`;
