import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_BYTES, MAX_AVATAR_DIMENSION } from './constants.js';
import { normalizeRolePack } from './contracts.js';
import { readZip } from './zip-reader.js';
import { assert, isRecord, makeId } from './utils.js';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parsePngPayload(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  assert(signature.every((value, index) => bytes[index] === value), 'PNG 签名无效');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payloads = new Map();
  let offset = 8;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = new TextDecoder('ascii').decode(typeBytes);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    assert(dataEnd + 4 <= bytes.length, 'PNG chunk 越界');
    const expectedCrc = view.getUint32(dataEnd, false);
    assert(crc32(bytes.subarray(offset + 4, dataEnd)) === expectedCrc, `PNG ${type} 校验失败`);
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === 'tEXt') {
      const separator = data.indexOf(0);
      if (separator > 0) {
        const key = new TextDecoder('latin1').decode(data.subarray(0, separator));
        if (key === 'chara' || key === 'ccv3') {
          if (payloads.has(key)) throw new Error(`PNG 包含重复 ${key} payload`);
          payloads.set(key, new TextDecoder('latin1').decode(data.subarray(separator + 1)));
        }
      }
    }
    if (type === 'IEND') { sawEnd = true; break; }
    offset = dataEnd + 4;
  }
  assert(sawEnd, 'PNG 缺少 IEND');
  assert(payloads.size, 'PNG 中未找到角色卡 payload');
  const decodeBase64 = (base64) => typeof globalThis.atob === 'function'
    ? Uint8Array.from(globalThis.atob(base64), (char) => char.charCodeAt(0))
    : Uint8Array.from(Buffer.from(base64, 'base64'));
  const parsed = [...payloads.entries()].map(([key, base64]) => [key, JSON.parse(new TextDecoder().decode(decodeBase64(base64)))]);
  if (parsed.length > 1 && JSON.stringify(parsed[0][1]) !== JSON.stringify(parsed[1][1])) throw new Error('PNG 的 chara 与 ccv3 内容不一致');
  return parsed.find(([key]) => key === 'ccv3')?.[1] || parsed[0][1];
}

function fragmentsFromBook(book) {
  const entries = Array.isArray(book?.entries) ? book.entries : Object.values(book?.entries || {});
  return entries.slice(0, 200).map((entry) => ({
    id: String(entry.uid ?? entry.id ?? makeId('fragment')),
    title: String(entry.comment || entry.name || '世界书条目'),
    keys: Array.isArray(entry.keys) ? entry.keys.map(String) : Array.isArray(entry.key) ? entry.key.map(String) : [],
    content: String(entry.content || '').slice(0, 20_000),
  }));
}

function roleFromCard(card, source) {
  const data = isRecord(card?.data) ? card.data : card;
  assert(isRecord(data), '角色卡 JSON 结构无效');
  return normalizeRolePack({
    name: data.name,
    summary: data.description,
    persona: data.personality || data.scenario,
    variables: { core: {}, custom: { characterBookName: data.character_book?.name || '' } },
    worldbookFragments: fragmentsFromBook(data.character_book),
    provenance: { source, spec: card.spec || 'legacy', importedAt: new Date().toISOString() },
  });
}

function avatarFromDataUrl(value) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(value || ''));
  if (!match) return null;
  const compact = match[2].replace(/\s+/g, '');
  assert(compact.length <= Math.ceil(MAX_AVATAR_BYTES * 4 / 3) + 8, '内嵌头像超过容量限制');
  const bytes = typeof globalThis.atob === 'function'
    ? Uint8Array.from(globalThis.atob(compact), (char) => char.charCodeAt(0))
    : Uint8Array.from(Buffer.from(compact, 'base64'));
  return new Blob([bytes], { type: match[1].toLowerCase() });
}

async function parseZipRole(buffer, sourceName) {
  const files = await readZip(buffer);
  const candidates = ['hypnoos-role-pack.json', 'card.json', 'character.json', 'manifest.json'];
  const path = candidates.find((name) => files.has(name)) || [...files.keys()].find((name) => /(^|\/)(card|character)\.json$/i.test(name));
  assert(path, 'ZIP/CharX 中没有可识别的角色 JSON');
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files.get(path)));
  const role = parsed.schema === 'RolePack/v1' ? normalizeRolePack(parsed) : roleFromCard(parsed, `charx:${sourceName}`);
  const avatarPath = parsed.avatar || parsed.assets?.avatar || parsed.avatarPath;
  if (avatarPath && files.has(avatarPath)) role.pendingAvatar = new Blob([files.get(avatarPath)]);
  return role;
}

export async function importRoleFile(file) {
  assert(file instanceof Blob, '请选择角色包文件');
  const name = String(file.name || '角色包');
  const buffer = await file.arrayBuffer();
  const lower = name.toLowerCase();
  let role;
  if (lower.endsWith('.png') || file.type === 'image/png') {
    role = roleFromCard(parsePngPayload(new Uint8Array(buffer)), `png:${name}`);
    role.pendingAvatar = file;
  } else if (lower.endsWith('.charx') || lower.endsWith('.zip') || file.type.includes('zip')) {
    role = await parseZipRole(buffer, name);
  } else {
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    role = parsed.schema === 'RolePack/v1' ? normalizeRolePack(parsed) : roleFromCard(parsed, `json:${name}`);
    const embeddedAvatar = parsed.avatarDataUrl || parsed.assets?.avatarDataUrl || parsed.assets?.avatar?.data;
    if (embeddedAvatar) role.pendingAvatar = avatarFromDataUrl(embeddedAvatar);
  }
  if (role.pendingAvatar) await validateAvatar(role.pendingAvatar);
  return role;
}

export async function validateAvatar(blob) {
  assert(blob.size <= MAX_AVATAR_BYTES, '头像文件超过 8MB');
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const detected = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
      : new TextDecoder('ascii').decode(bytes.subarray(0, 4)) === 'RIFF' ? 'image/webp'
        : new TextDecoder('ascii').decode(bytes.subarray(0, 3)) === 'GIF' ? 'image/gif' : '';
  assert(ALLOWED_AVATAR_TYPES.has(detected), '头像必须是 PNG、JPEG、WebP 或 GIF');
  if (globalThis.createImageBitmap) {
    const image = await createImageBitmap(blob);
    const width = image.width;
    const height = image.height;
    image.close();
    assert(width > 0 && height > 0 && width <= MAX_AVATAR_DIMENSION && height <= MAX_AVATAR_DIMENSION, '头像尺寸无效或超过 4096px');
  }
  return { type: detected, size: blob.size };
}
