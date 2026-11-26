export const cursor = {
  config: '.cursor/hooks.json',
  allow: { continue: true },
  block: (reason: string) => ({ continue: false, user_message: reason }),
};
