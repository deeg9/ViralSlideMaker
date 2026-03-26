const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function validateImageFile(file: File): string | null {
  if (!file || file.size === 0) return 'No file provided'
  if (file.size > MAX_FILE_SIZE) return 'File must be under 5MB'
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return 'Only PNG, JPG, WebP, and GIF images are allowed'
  return null
}

export function validateFileName(fileName: string): string | null {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'Only PNG, JPG, WebP, and GIF files are allowed'
  return null
}
