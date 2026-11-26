const labeledChatEditors =
  'textarea[aria-label*="prompt" i], textarea[aria-label*="message" i], textarea[placeholder^="Ask" i], textarea[placeholder^="Message" i], textarea[placeholder^="Type a message" i], [contenteditable][aria-label*="prompt" i], [contenteditable][aria-label*="message" i], [contenteditable][data-placeholder^="Ask" i]';
const conventionalEditors = [
  labeledChatEditors,
  'main [role="textbox"][contenteditable="true"], main [role="textbox"][contenteditable="plaintext-only"], main textarea:not([role="searchbox"])',
];

export const chatProviders = [
  { name: 'ChatGPT', origins: ['https://chatgpt.com'], editors: ['#prompt-textarea, [data-testid="prompt-textarea"], textarea[name="prompt"]', 'form:has(#composer-submit-button, [data-testid="send-button"], [aria-label="Send prompt" i]) [contenteditable]', 'div.ProseMirror[contenteditable="true"], [contenteditable][data-virtualkeyboardpolicy]'] },
  { name: 'Claude', origins: ['https://claude.ai'], editors: ['div.ProseMirror[contenteditable="true"]'] },
  { name: 'Gemini', origins: ['https://gemini.google.com'], editors: ['rich-textarea [contenteditable="true"]', '.ql-editor[contenteditable="true"]'] },
  { name: 'Grok', origins: ['https://grok.com'], editors: ['textarea#chat-input, textarea[name="prompt"]'] },
  { name: 'DeepSeek', origins: ['https://chat.deepseek.com'], editors: ['textarea#chat-input, textarea[name="prompt"]'] },
  { name: 'Perplexity', origins: ['https://www.perplexity.ai', 'https://perplexity.ai'], editors: ['#ask-input, #prompt-textarea', '[contenteditable="true"][data-lexical-editor="true"]'] },
  { name: 'Microsoft Copilot', origins: ['https://copilot.com', 'https://copilot.microsoft.com'], editors: ['textarea#userInput, textarea#chat-input'] },
  { name: 'Mistral Vibe', origins: ['https://chat.mistral.ai'], editors: ['#chat-input, textarea[name="message"]', 'div.ProseMirror[contenteditable="true"]'] },
  { name: 'Poe', origins: ['https://poe.com'], editors: ['textarea[class*="ChatMessageInput"], textarea[data-testid="chat-input"]'] },
  { name: 'Qwen', origins: ['https://chat.qwen.ai'], editors: ['textarea#chat-input, textarea[name="prompt"]'] },
];

export const chatOrigins = chatProviders.flatMap(provider => provider.origins);

export function findChatProvider(url?: string) {
  return chatProviders.find(provider => provider.origins.some(origin => url === origin || url?.startsWith(origin + '/')));
}

export function chatEditorSelectors(url?: string) {
  const provider = findChatProvider(url);
  return provider ? [...provider.editors, ...conventionalEditors] : [];
}


export function chatPasteEditorSelectors(url?: string) {
  const provider = findChatProvider(url);
  return provider ? [...provider.editors, labeledChatEditors] : [];
}
