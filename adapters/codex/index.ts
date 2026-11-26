export const codex = {
  config: '.codex/hooks.json',
  block: (reason: string) => ({ decision: 'block', reason }),
};

export function renderRelayProfile(port: number) {
  return `model_provider = "promptveil"
web_search = "disabled"

[model_providers.promptveil]
name = "PromptVeil"
base_url = "http://127.0.0.1:${port}/v1"
env_key = "PROMPTVEIL_GATEWAY_TOKEN"
wire_api = "responses"
supports_websockets = false
requires_openai_auth = false
request_max_retries = 0
stream_max_retries = 0
`;
}
