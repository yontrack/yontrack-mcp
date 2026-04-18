## [1.9.1](https://github.com/yontrack/yontrack-mcp/compare/v1.9.0...v1.9.1) (2026-04-18)


### Bug Fixes

* add conversion, decoding, and metadata policy strategies to ExternalSecret ([81c4b29](https://github.com/yontrack/yontrack-mcp/commit/81c4b29c13be293177f3b4d971adc0de582475af))

# [1.9.0](https://github.com/yontrack/yontrack-mcp/compare/v1.8.0...v1.9.0) (2026-04-18)


### Features

* add External Secrets Operator (ESO) integration to chart ([b65a26d](https://github.com/yontrack/yontrack-mcp/commit/b65a26d90cfd7dc9472943d0d14d84a00d26b2fc))

# [1.8.0](https://github.com/yontrack/yontrack-mcp/compare/v1.7.0...v1.8.0) (2026-04-03)


### Features

* serve server icon and advertise it in MCP server info ([e69c34f](https://github.com/yontrack/yontrack-mcp/commit/e69c34f6d7660316cfa7cc136ef3ef2b9ff95868))

# [1.7.0](https://github.com/yontrack/yontrack-mcp/compare/v1.6.0...v1.7.0) (2026-04-03)


### Features

* instruct Claude to prefer displayName over name when displaying entities ([ad27841](https://github.com/yontrack/yontrack-mcp/commit/ad27841365620a0ffb93800b80d8b3dcb20dc8d2))

# [1.6.0](https://github.com/yontrack/yontrack-mcp/compare/v1.5.4...v1.6.0) (2026-04-03)


### Bug Fixes

* move instructions to McpServer options second argument ([c372e75](https://github.com/yontrack/yontrack-mcp/commit/c372e75fa72e9bb55b7e868a4128caf4d0671c19))
* suppress /health endpoint from request logs ([a118773](https://github.com/yontrack/yontrack-mcp/commit/a118773ed6e59ade2c5d5c5070eb07ef912d97ff))


### Features

* instructions about preferring GraphQL for complex queries ([d52786c](https://github.com/yontrack/yontrack-mcp/commit/d52786c732c8ca22c98cce32580b85cb85c4e881))

## [1.5.4](https://github.com/yontrack/yontrack-mcp/compare/v1.5.3...v1.5.4) (2026-04-03)


### Bug Fixes

* more logging ([871e9f4](https://github.com/yontrack/yontrack-mcp/commit/871e9f4970ee93ca6368ed7dd085af245e2be559))

## [1.5.3](https://github.com/yontrack/yontrack-mcp/compare/v1.5.2...v1.5.3) (2026-04-03)


### Bug Fixes

* logging ([0f4b1cf](https://github.com/yontrack/yontrack-mcp/commit/0f4b1cff936f534edd03547a4c842cfc1606314c))

## [1.5.2](https://github.com/yontrack/yontrack-mcp/compare/v1.5.1...v1.5.2) (2026-04-03)


### Bug Fixes

* persisting the tokens ([a6cc043](https://github.com/yontrack/yontrack-mcp/commit/a6cc043efe0199d7075228a3cc7d022727cc0159))

## [1.5.1](https://github.com/yontrack/yontrack-mcp/compare/v1.5.0...v1.5.1) (2026-04-03)


### Bug Fixes

* trusting the proxy ([2bf0115](https://github.com/yontrack/yontrack-mcp/commit/2bf0115964a351949a75e14515e4742a1505266f))

# [1.5.0](https://github.com/yontrack/yontrack-mcp/compare/v1.4.0...v1.5.0) (2026-04-03)


### Features

* OIDC authentication ([e3b45d7](https://github.com/yontrack/yontrack-mcp/commit/e3b45d75d287e6fa6803f1eb9edf939910de4064))

# [1.4.0](https://github.com/yontrack/yontrack-mcp/compare/v1.3.1...v1.4.0) (2026-04-02)


### Features

* restricting the access to the mutations ([8d464fa](https://github.com/yontrack/yontrack-mcp/commit/8d464fadedafaf73235f50a931eee6912b9d1024))

## [1.3.1](https://github.com/yontrack/yontrack-mcp/compare/v1.3.0...v1.3.1) (2026-04-02)


### Bug Fixes

* missing GraphQL file ([1aa6890](https://github.com/yontrack/yontrack-mcp/commit/1aa6890ab2b723a4d028eea82bfe2036d9ca77e4))

# [1.3.0](https://github.com/yontrack/yontrack-mcp/compare/v1.2.2...v1.3.0) (2026-04-02)


### Features

* GraphQL tools ([3f42a64](https://github.com/yontrack/yontrack-mcp/commit/3f42a64e591484ca24742c630e6f31a56f4ff48b))

## [1.2.2](https://github.com/yontrack/yontrack-mcp/compare/v1.2.1...v1.2.2) (2026-04-01)


### Bug Fixes

* aligning the Docker image version with the Helm chart ([0b5c2b0](https://github.com/yontrack/yontrack-mcp/commit/0b5c2b0a3ffe8b4e22aaedf3d7e2eba923886fc4))

## [1.2.1](https://github.com/yontrack/yontrack-mcp/compare/v1.2.0...v1.2.1) (2026-04-01)


### Bug Fixes

* removing the OIDC features ([110d686](https://github.com/yontrack/yontrack-mcp/commit/110d6865fde59f1b27a7edd213acec55144dfe93))

# [1.2.0](https://github.com/yontrack/yontrack-mcp/compare/v1.1.0...v1.2.0) (2026-04-01)


### Features

* Helm chart config & docs ([8fe2d8b](https://github.com/yontrack/yontrack-mcp/commit/8fe2d8b04d30f389e054d2e35d2ae5cf93d3960c))

# [1.1.0](https://github.com/yontrack/yontrack-mcp/compare/v1.0.0...v1.1.0) (2026-04-01)


### Features

* Helm chart ([b507e16](https://github.com/yontrack/yontrack-mcp/commit/b507e16187f1285b7c44b310b7d181ea841a35bd))

# 1.0.0 (2026-04-01)


### Bug Fixes

* trigger initial release ([9f9e200](https://github.com/yontrack/yontrack-mcp/commit/9f9e2009a08c5c2ea7982ec731e2beaed34887ee))
