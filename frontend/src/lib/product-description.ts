export type ProductDescriptionBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

const bulletPattern = /^(?:[*•‣▪◦-])\s+(.+)$/;
const maxBlocks = 80;
const maxListItems = 100;
const headingLimit = 80;
const previewLimit = 1200;

function blockSize(block: ProductDescriptionBlock): number {
  return block.type === 'list' ? block.items.reduce((total, item) => total + item.length + 2, 0) : block.text.length;
}

function headingAt(line: string, nextLine: string | undefined): boolean {
  if (line.length > headingLimit || /[.!?]$/.test(line)) return false;
  if (nextLine && bulletPattern.test(nextLine)) return true;
  if (/:$/.test(line)) return true;
  return line.length <= 60 && /[A-Z]/.test(line) && !/[a-z]/.test(line);
}

export function parseProductDescription(text: string): ProductDescriptionBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ProductDescriptionBlock[] = [];
  let index = 0;

  while (index < lines.length && blocks.length < maxBlocks) {
    const line = lines[index]!.trim();
    if (!line) { index += 1; continue; }

    const bullet = bulletPattern.exec(line);
    if (bullet) {
      const items: string[] = [];
      while (index < lines.length && items.length < maxListItems) {
        const current = lines[index]!.trim();
        if (!current) {
          const next = lines[index + 1]?.trim();
          if (next && bulletPattern.test(next)) { index += 1; continue; }
          break;
        }
        const match = bulletPattern.exec(current);
        if (!match) break;
        items.push(match[1]!.trim());
        index += 1;
      }
      if (items.length) blocks.push({ type: 'list', items });
      continue;
    }

    let next = lines[index + 1]?.trim();
    if (!next) {
      let scan = index + 2;
      while (scan < lines.length && !lines[scan]!.trim()) scan += 1;
      next = lines[scan]?.trim();
    }
    if (headingAt(line, next)) {
      blocks.push({ type: 'heading', text: line });
      index += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const current = lines[index]!.trim();
      if (!current || bulletPattern.test(current)) break;
      let following = lines[index + 1]?.trim();
      if (!following) {
        let scan = index + 2;
        while (scan < lines.length && !lines[scan]!.trim()) scan += 1;
        following = lines[scan]?.trim();
      }
      if (headingAt(current, following)) break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  if (index < lines.length) {
    const remainder = lines.slice(index).map(line => line.trim()).filter(Boolean).join('\n');
    if (remainder) blocks.push({ type: 'paragraph', text: remainder });
  }

  return blocks;
}

function partialBlock(block: ProductDescriptionBlock, allowance: number): ProductDescriptionBlock | undefined {
  if (block.type === 'heading') return block;
  if (allowance < 40) return undefined;
  if (block.type === 'list') {
    const items: string[] = [];
    let used = 0;
    for (const item of block.items) {
      if (used + item.length > allowance && items.length) break;
      if (used + item.length > allowance) {
        const cut = item.lastIndexOf(' ', allowance);
        const end = cut >= 40 ? cut : Math.min(allowance, item.length);
        if (end > 0) items.push(item.slice(0, end).trimEnd());
        break;
      }
      items.push(item);
      used += item.length + 2;
    }
    return items.length ? { type: 'list', items } : undefined;
  }
  const cut = block.text.lastIndexOf(' ', allowance);
  const end = cut >= 40 ? cut : Math.min(allowance, block.text.length);
  return end > 0 ? { type: 'paragraph', text: block.text.slice(0, end).trimEnd() } : undefined;
}

export function previewProductDescription(
  blocks: ProductDescriptionBlock[], limit = previewLimit,
): { blocks: ProductDescriptionBlock[]; hasMore: boolean } {
  const preview: ProductDescriptionBlock[] = [];
  let used = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const size = blockSize(block);
    if (used + size <= limit) {
      preview.push(block);
      used += size;
      continue;
    }
    const allowance = Math.max(limit - used, preview.length ? 0 : limit);
    const partial = partialBlock(block, allowance);
    if (partial) preview.push(partial);
    return { blocks: preview, hasMore: true };
  }
  return { blocks: preview, hasMore: false };
}
