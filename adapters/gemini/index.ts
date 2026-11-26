export const gemini = {
  config: '.gemini/settings.json',
  block: (reason: string) => ({ decision: 'deny', reason }),
};
