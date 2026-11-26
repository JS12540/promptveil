export const claudeCode = {
  config: '.claude/settings.json',
  block: (reason: string) => ({ decision: 'block', reason }),
};
