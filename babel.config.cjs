// babel.config.js
module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-react', // <-- This is what your error is complaining about
    '@babel/preset-typescript',
  ],
};
