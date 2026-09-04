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
  const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/i;
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
 * Parses user chat message for file or image attachment markers:
 * - 📷 [Gambar: filename|url]
 * - 📎 [Lampiran: filename|url]
 */
export function parseChatMessageAttachment(content: string): {
  cleanText: string;
  attachmentName: string | null;
  attachmentUrl: string | null;
  isImage: boolean;
} {
  if (!content) {
    return { cleanText: "", attachmentName: null, attachmentUrl: null, isImage: false };
  }

  let text = content;
  let attachmentName: string | null = null;
  let attachmentUrl: string | null = null;
  let isImage = false;

  // 1. Check for 📷 [Gambar: filename|url] or 📷 [Gambar: filename]
  const imgMatch = text.match(/📷\s*\[Gambar:\s*([^\|\]]+)(?:\|([^\]]+))?\]/);
  if (imgMatch) {
    attachmentName = imgMatch[1].trim();
    attachmentUrl = imgMatch[2]?.trim() || null;
    isImage = true;
    text = text.replace(imgMatch[0], "").trim();
  } else {
    // 2. Check for 📎 [Lampiran: filename|url] or 📎 [Lampiran: filename]
    const fileMatch = text.match(/📎\s*\[Lampiran:\s*([^\|\]]+)(?:\|([^\]]+))?\]/);
    if (fileMatch) {
      attachmentName = fileMatch[1].trim();
      attachmentUrl = fileMatch[2]?.trim() || null;
      const lower = (attachmentName + " " + (attachmentUrl || "")).toLowerCase();
      isImage =
        /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(lower) ||
        (!!attachmentUrl && /\.(png|jpg|jpeg|webp|gif|svg)/i.test(attachmentUrl));
      text = text.replace(fileMatch[0], "").trim();
    }
  }

  return { cleanText: text, attachmentName, attachmentUrl, isImage };
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
