---
name: mcp-builder
description: Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Follows Anthropic's official 4-phase gold standard.
---

# MCP Server Development Guide Skill

Enables Claude to design, implement, audit, and benchmark MCP servers in Node/TypeScript and Python.

## 4-Phase Protocol
1. **Phase 1 (Research & Architecture):** Choose Node/TypeScript SDK with StdioServerTransport.
2. **Phase 2 (Implementation):** Zod schema validation, actionable error messages, prefixing (`service_*`).
3. **Phase 3 (Review & Test):** Pure stdio JSON-RPC 2.0 validation (stderr logging only).
4. **Phase 4 (Evaluations):** Benchmark XML Q&A suites to verify complex tool execution.
