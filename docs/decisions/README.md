# Architecture decisions

| Decision | Rationale |
| --- | --- |
| Shared rules-based detector | Context checks make the first build auditable and keep downloads small. Offline ML can be evaluated separately. |
| Extension-owned composer | Raw input stays in the extension while scanning. Destination access is limited to an explicit toolbar action and the selected tab. |
| Mobile protect and copy | An installable PWA works without extending another app's input surface. |
| Native blocking plus a dedicated Codex relay | Prompt hooks can stop a covered submission. The separate Responses route can inspect later model requests and preserve streaming. |
| Static website and packaged downloads | The site and app can deploy together over HTTPS, with versioned CLI and extension archives for clean installation and rollback. |
