/**
 * File Type Registry — Complete file type definitions and detection rules
 */

// ─── File Categories ──────────────────────────────────
export const CATEGORIES = {
  TEXT: 'text',
  IMAGE: 'image',
  PDF: 'pdf',
  OFFICE: 'office',
  ARCHIVE: 'archive',
  BINARY: 'binary',
  UNKNOWN: 'unknown',
}

// ─── File Type Definitions ────────────────────────────
export const FILE_TYPES = {
  // Code & Config (text)
  code: {
    category: CATEGORIES.TEXT,
    extensions: [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.go', '.rs', '.java', '.kt', '.kts',
      '.c', '.cpp', '.h', '.hpp', '.swift', '.m',
      '.rb', '.php', '.scala', '.clj', '.ex', '.exs',
      '.lua', '.r', '.jl', '.dart', '.zig', '.nim',
    ],
    maxSize: 5 * 1024 * 1024, // 5MB
    handler: 'text',
    description: 'Source code files',
  },

  config: {
    category: CATEGORIES.TEXT,
    extensions: [
      '.json', '.yaml', '.yml', '.toml', '.xml', '.ini',
      '.conf', '.config', '.env.example', '.lock',
      '.graphql', '.gql', '.proto', '.prisma',
    ],
    maxSize: 2 * 1024 * 1024,
    handler: 'text',
    description: 'Configuration files',
  },

  doc: {
    category: CATEGORIES.TEXT,
    extensions: [
      '.md', '.mdx', '.txt', '.rst', '.adoc',
      '.csv', '.tsv', '.log', '.diff', '.patch',
    ],
    maxSize: 2 * 1024 * 1024,
    handler: 'text',
    description: 'Documentation and text files',
  },

  web: {
    category: CATEGORIES.TEXT,
    extensions: [
      '.html', '.htm', '.css', '.scss', '.sass', '.less',
      '.svg', '.vue', '.svelte', '.astro',
    ],
    maxSize: 3 * 1024 * 1024,
    handler: 'text',
    description: 'Web markup and styles',
  },

  // Image files
  image: {
    category: CATEGORIES.IMAGE,
    extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.ico', '.tiff', '.avif'],
    maxSize: 10 * 1024 * 1024, // 10MB
    handler: 'image',
    description: 'Image files for VL analysis',
    mimeMap: {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
      '.tiff': 'image/tiff',
      '.avif': 'image/avif',
    },
  },

  // PDF
  pdf: {
    category: CATEGORIES.PDF,
    extensions: ['.pdf'],
    maxSize: 50 * 1024 * 1024,
    handler: 'pdf',
    description: 'PDF documents',
  },

  // Office documents
  office: {
    category: CATEGORIES.OFFICE,
    extensions: ['.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'],
    maxSize: 30 * 1024 * 1024,
    handler: 'office',
    description: 'Microsoft Office documents',
  },

  // Archives
  archive: {
    category: CATEGORIES.ARCHIVE,
    extensions: ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar'],
    maxSize: 100 * 1024 * 1024,
    handler: 'archive',
    description: 'Archive files (metadata only)',
  },

  // Binary (reject)
  binary: {
    category: CATEGORIES.BINARY,
    extensions: [
      '.exe', '.dll', '.so', '.dylib', '.app',
      '.bin', '.dat', '.db', '.sqlite', '.sqlite3',
      '.wasm', '.class', '.jar', '.war',
      '.pyc', '.o', '.a', '.lib',
    ],
    handler: 'reject',
    description: 'Binary files (read rejected)',
  },

  // Media (metadata only)
  media: {
    category: CATEGORIES.BINARY,
    extensions: [
      '.mp3', '.wav', '.flac', '.aac', '.ogg',
      '.mp4', '.mov', '.avi', '.mkv', '.webm',
      '.ttf', '.otf', '.woff', '.woff2',
    ],
    handler: 'reject',
    description: 'Media and font files (metadata only)',
  },
}

// ─── Quick Lookup Maps ────────────────────────────────
const EXT_TO_TYPE = new Map()
for (const [typeName, def] of Object.entries(FILE_TYPES)) {
  for (const ext of def.extensions) {
    EXT_TO_TYPE.set(ext, typeName)
  }
}

// ─── Detection Functions ──────────────────────────────
export function detectFileType(filePath) {
  const ext = getExtension(filePath).toLowerCase()
  const typeName = EXT_TO_TYPE.get(ext) || 'unknown'
  return { typeName, ...FILE_TYPES[typeName], extension: ext }
}

export function getExtension(filePath) {
  const base = filePath.split('/').pop() || ''
  // Handle multi-part extensions like .tar.gz
  if (base.endsWith('.tar.gz')) return '.tar.gz'
  if (base.endsWith('.tar.bz2')) return '.tar.bz2'
  const dot = base.lastIndexOf('.')
  return dot >= 0 ? base.slice(dot) : ''
}

export function getCategory(filePath) {
  const { typeName } = detectFileType(filePath)
  return FILE_TYPES[typeName]?.category || CATEGORIES.UNKNOWN
}

export function isTextFile(filePath) {
  return getCategory(filePath) === CATEGORIES.TEXT
}

export function isImageFile(filePath) {
  return getCategory(filePath) === CATEGORIES.IMAGE
}

export function isBinaryFile(filePath) {
  const cat = getCategory(filePath)
  return cat === CATEGORIES.BINARY
}

export function getMimeType(filePath) {
  const ext = getExtension(filePath).toLowerCase()
  return FILE_TYPES.image.mimeMap[ext] || 'application/octet-stream'
}

export { EXT_TO_TYPE, CATEGORIES as FileCategories }
