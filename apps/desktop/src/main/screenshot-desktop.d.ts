declare module 'screenshot-desktop' {
  const screenshot: () => Promise<Buffer>;
  export default screenshot;
}
