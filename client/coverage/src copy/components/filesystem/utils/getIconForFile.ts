import type { BlobItem } from '../types';

export const getIconForFile = (item: BlobItem): string => {
  if (item.isDirectory) {
    return '📁'; // Folder
  }

  const extension = item.name.split('.').pop()?.toLowerCase() || '';
  const contentType = item.contentType?.toLowerCase() || '';

  // Prioritize content type for common web types
  if (contentType.startsWith('image/')) return '🖼️'; // Image
  if (contentType.startsWith('video/')) return '🎬'; // Video
  if (contentType.startsWith('audio/')) return '🎵'; // Audio
  if (contentType === 'application/pdf') return '📕'; // PDF (using book emoji)
  if (contentType.startsWith('text/')) return '📝'; // Text document

  // Fallback to extension for other common types
  switch (extension) {
    case 'doc':
    case 'docx':
      return '📄'; // Word Doc
    case 'xls':
    case 'xlsx':
      return '📊'; // Excel Sheet
    case 'ppt':
    case 'pptx':
      return '🖥️'; // Presentation (using screen emoji)
    case 'zip':
    case 'rar':
    case '7z':
      return '📦'; // Archive/Package
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return '💻'; // Code (using laptop emoji)
    case 'json':
      return '⚙️'; // JSON (using gear emoji)
    case 'html':
    case 'css':
      return '🌐'; // Web file
    default:
      return '📄'; // Generic document
  }
};
