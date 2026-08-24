import { assert } from './utils.js';

const MAX_ARCHIVE_ENTRIES = 256;
const MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;

function u16(view, offset) { return view.getUint16(offset, true); }
function u32(view, offset) { return view.getUint32(offset, true); }
function decodeName(bytes) { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }

async function inflateRaw(bytes) {
  if (!globalThis.DecompressionStream) throw new Error('当前浏览器不支持安全解压 CharX/ZIP');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let index = Math.max(0, bytes.length - 65_557); index <= bytes.length - 22; index += 1) {
    if (u32(view, index) === 0x06054b50) eocd = index;
  }
  assert(eocd >= 0, 'ZIP 结束目录不存在');
  const entryCount = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);
  assert(entryCount <= MAX_ARCHIVE_ENTRIES, 'ZIP 文件数超出限制');
  assert(centralOffset + centralSize <= bytes.length, 'ZIP 中央目录越界');

  const files = new Map();
  let cursor = centralOffset;
  let totalSize = 0;
  for (let index = 0; index < entryCount; index += 1) {
    assert(u32(view, cursor) === 0x02014b50, 'ZIP 中央目录损坏');
    const method = u16(view, cursor + 10);
    const compressedSize = u32(view, cursor + 20);
    const uncompressedSize = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localOffset = u32(view, cursor + 42);
    const name = decodeName(bytes.subarray(cursor + 46, cursor + 46 + nameLength)).replace(/\\/g, '/');
    assert(!name.startsWith('/') && !name.split('/').includes('..'), 'ZIP 路径越界');
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    totalSize += uncompressedSize;
    assert(totalSize <= MAX_UNCOMPRESSED_BYTES, 'ZIP 解压总量超出限制');
    assert(u32(view, localOffset) === 0x04034b50, 'ZIP 本地文件头损坏');
    const localNameLength = u16(view, localOffset + 26);
    const localExtraLength = u16(view, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    assert(dataOffset + compressedSize <= bytes.length, 'ZIP 文件数据越界');
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    let output;
    if (method === 0) output = new Uint8Array(compressed);
    else if (method === 8) output = await inflateRaw(compressed);
    else throw new Error(`不支持的 ZIP 压缩方法：${method}`);
    assert(output.length === uncompressedSize, `ZIP 文件尺寸不匹配：${name}`);
    files.set(name, output);
  }
  return files;
}
