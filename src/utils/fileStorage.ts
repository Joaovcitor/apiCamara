import path from 'path';
import { promises as fs } from 'fs';

const ENV_UPLOAD_DIR = process.env['UPLOAD_DIR'] || './uploads';

export function getUploadDir(): string {
  return path.resolve(process.cwd(), ENV_UPLOAD_DIR);
}

export async function ensureUploadDir(): Promise<string> {
  const dir = getUploadDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function sanitizeFilename(name: string): string {
  // Evitar path traversal e caracteres inválidos
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Novo: sanitizar segmentos de subpastas
function sanitizePathSegment(seg: string): string {
  return seg.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+$/, '_');
}

function timestampSuffix(): string {
  // AAAA-MM-DD_HH-mm-ss
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  return iso;
}

// Alterado: aceitar subpasta opcional e retornar caminho público relativo
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  subdir?: string
): Promise<{ storedName: string; fullPath: string; publicPath: string }> {
  const baseDir = await ensureUploadDir();

  let targetDir = baseDir;
  let publicDir = '';
  if (subdir && subdir.trim().length > 0) {
    const parts = subdir.split(/[\\/]+/).map(sanitizePathSegment).filter(Boolean);
    publicDir = parts.join('/');
    targetDir = path.join(baseDir, ...parts);
    await fs.mkdir(targetDir, { recursive: true });
  }

  const ext = path.extname(originalName);
  const nameOnly = path.basename(originalName, ext);

  let storedName = sanitizeFilename(`${nameOnly}${ext}`);
  let fullPath = path.join(targetDir, storedName);

  // Se já existe, adicionar sufixo de timestamp
  try {
    await fs.access(fullPath);
    storedName = sanitizeFilename(`${nameOnly}-${timestampSuffix()}${ext}`);
    fullPath = path.join(targetDir, storedName);
  } catch {
    // Arquivo não existe, segue com o nome original sanitizado
  }

  await fs.writeFile(fullPath, buffer);

  const publicPath = publicDir ? `${publicDir}/${encodeURIComponent(storedName)}` : encodeURIComponent(storedName);

  return { storedName, fullPath, publicPath };
}

// Alterado: aceita nome ou caminho relativo
export function getPublicUrl(storedOrRelativePath: string): string {
  // Os arquivos serão servidos via express.static em /files
  return `/files/${storedOrRelativePath}`;
}