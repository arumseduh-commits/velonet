/**
 * Utility to extract embedded images (HTML <img> or Markdown ![alt](url)) from question text
 * and return clean text alongside the resolved imageUrl.
 */
export function parseQuestionContent(
  text: string,
  existingImageUrl?: string | null
): {
  cleanText: string;
  imageUrl: string | null;
} {
  if (!text) return { cleanText: "", imageUrl: existingImageUrl || null };

  let cleanText = text;
  let imageUrl = existingImageUrl || null;

  // 1. Check for HTML <img> tag with src attribute
  const imgTagRegex = /<img[^>]*src=['"]([^'"]+)['"][^>]*>/i;
  const match = cleanText.match(imgTagRegex);
  if (match) {
    if (!imageUrl) {
      imageUrl = match[1];
    }
    // Remove wrapper div or p around img
    cleanText = cleanText
      .replace(/<div[^>]*>\s*<img[^>]*>\s*<\/div>/gi, "")
      .replace(/<p[^>]*>\s*<img[^>]*>\s*<\/p>/gi, "")
      .replace(/<img[^>]*>/gi, "")
      .replace(/<div[^>]*><\/div>/gi, "")
      .trim();
  }

  // 2. Check for Markdown image syntax: ![alt](url)
  const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/i;
  const mdMatch = cleanText.match(mdImgRegex);
  if (mdMatch) {
    if (!imageUrl) {
      imageUrl = mdMatch[2];
    }
    cleanText = cleanText.replace(mdImgRegex, "").trim();
  }

  // 3. Clean up any leftover empty div tags or unclosed tags
  cleanText = cleanText
    .replace(/^<div[^>]*>/i, "")
    .replace(/<\/div>$/i, "")
    .trim();

  return { cleanText, imageUrl };
}

/**
 * Sanitizes a question object so that any HTML image is converted to `imageUrl`
 */
export function sanitizeQuestionItem<T extends { text: string; imageUrl?: string | null }>(
  q: T
): T {
  const { cleanText, imageUrl } = parseQuestionContent(q.text, q.imageUrl);
  return {
    ...q,
    text: cleanText,
    imageUrl: imageUrl || q.imageUrl || null,
  };
}
