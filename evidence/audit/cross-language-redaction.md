# Cross-language source and configuration redaction

The shared scanner covers common credential assignments, literal environment writes, runtime variable references, container environment declarations, and Kubernetes environment value pairs. The regression includes JavaScript and TypeScript, Python, Go, Kotlin, PowerShell, and PHP-style examples. Multiline YAML and TOML cases include full credential values. [YAML scalar specification](https://yaml.org/spec/1.2.2/) · [TOML string specification](https://toml.io/en/v1.0.0-rc.1)

The PWA and CLI expose a general config mode. JSON config keeps keys and container structure while replacing scalar values. Common line-based assignments are also covered, including unfamiliar keys. The Codex relay uses source matching and masks values in structured environment maps. The original data remains local to the input path. The masked copy is intended for sharing, and program semantics can change when values are replaced.

Typecheck and 41 local tests passed. One loopback test was skipped. The 650-prompt synthetic evaluation, build, and checksum verification passed. Packaged smoke checks covered nested JSON in the PWA worker and CLI and redacted source through the relay sanitizer. Live browser and routed-agent checks remain pending.
