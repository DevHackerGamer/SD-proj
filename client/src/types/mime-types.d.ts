declare module 'mime-types' {
  export function lookup(filename: string): string | false;
  export function extension(mimeType: string): string | false;
  export const types: Record<string, string>;
  export const extensions: Record<string, string[]>;
}
