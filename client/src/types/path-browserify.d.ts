declare module 'path-browserify' {
  export function extname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  
  // Add other path functions as needed
  
  const pathBrowserify: {
    extname: typeof extname;
    basename: typeof basename;
    dirname: typeof dirname;
    join: typeof join;
  };
  
  export default pathBrowserify;
}
