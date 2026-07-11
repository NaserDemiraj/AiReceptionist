/** Splits long text into ~targetSize-char chunks on paragraph/sentence boundaries. */
export function splitIntoChunks(text: string, targetSize = 900): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= targetSize) return [clean];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= targetSize) {
      current += (current ? "\n\n" : "") + para;
      continue;
    }
    flush();
    if (para.length <= targetSize) {
      current = para;
      continue;
    }
    // Paragraph itself too long — split on sentences
    let sentenceBuf = "";
    for (const sentence of para.split(/(?<=[.!?])\s+/)) {
      if (sentenceBuf.length + sentence.length + 1 > targetSize && sentenceBuf) {
        chunks.push(sentenceBuf.trim());
        sentenceBuf = "";
      }
      sentenceBuf += (sentenceBuf ? " " : "") + sentence;
    }
    if (sentenceBuf.trim()) current = sentenceBuf.trim();
  }
  flush();
  return chunks;
}

/** Very small HTML → text conversion for URL ingestion. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
