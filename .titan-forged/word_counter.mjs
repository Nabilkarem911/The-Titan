async function handler(params) { const text = params.text || ""; return { count: text.split(" ").filter(Boolean).length }; }
export { handler };
