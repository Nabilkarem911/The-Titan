async function handler(params) { return { words: params.text.split(" ").length }; }
export { handler };
