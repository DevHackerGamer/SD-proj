/// <reference types="vite/client" />

// Add these declarations for CSS Modules
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// You might have other declarations here already, leave them as they are.
