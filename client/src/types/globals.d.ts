// Type declarations for modules without TypeScript definitions

declare module 'path-browserify' {
  /**
   * Return the extension of the path, from the last occurrence of the . (period) character to end of string in the last portion of the path.
   * If there is no . in the last portion of the path, or the first character of the basename is ., then an empty string is returned.
   */
  export function extname(p: string): string;
  
  /**
   * Return the last portion of a path. Similar to the Unix basename command.
   * Often used to extract the file name from a fully qualified path.
   */
  export function basename(p: string, ext?: string): string;
  
  /**
   * Return the directory name of a path. Similar to the Unix dirname command.
   */
  export function dirname(p: string): string;
  
  /**
   * Join all arguments together and normalize the resulting path.
   */
  export function join(...paths: string[]): string;
  
  /**
   * Normalize a string path, reducing '..' and '.' parts.
   */
  export function normalize(p: string): string;
}
