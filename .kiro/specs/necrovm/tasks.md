# NecroVM 8080 - Implementation Tasks

- [x] **Task 1: Project Scaffolding & Kiroween Governance**
  - Setup `.kiro/` directory with specs, steering, hooks, and MCP configs.
  - Setup `package.json`, `LICENSE` (MIT).

- [x] **Task 2: Intel 8080 CPU Core Implementation** (`src/cpu8080.mjs`)
  - Complete register set (A, B, C, D, E, H, L, SP, PC, Flags).
  - Parity lookup table and 8080 PSW bit packing.
  - Core instruction decoder with accurate T-state cycle counts.
  - Stack management (PUSH, POP, CALL, RET, RST).

- [x] **Task 3: CP/M 2.2 BDOS Syscall Subsystem** (`src/cpm_bdos.mjs`)
  - Warm boot at `0x0000`, BDOS entry point at `0x0005`.
  - Console character I/O (`C_WRITE`, `C_READ`, `C_WRITESTR`).
  - Virtual filesystem & DMA sector buffer (`F_OPEN`, `F_READ`).

- [x] **Task 4: Intel 8080 Two-Pass Assembler** (`src/assembler8080.mjs`)
  - Tokenizer for mnemonics, registers, constants (hex `$`, `0x`, `H`, octal, dec), strings.
  - Two-pass symbol resolution and binary emission into RAM.

- [x] **Task 5: Model Context Protocol (MCP) Debugger** (`src/mcp_debugger.mjs`)
  - JSON-RPC 2.0 tool endpoints for AI Agent inspection and stepping.
  - Disassembly generator for inspection.

- [x] **Task 6: High-Fidelity Test Suite** (`tests/test_8080.mjs`)
  - Verify arithmetic, logic, branching, flags, BDOS calls, and assembler round-trip.
  - Ensure 100% passing rate with Node.js built-in test runner.

- [x] **Task 7: Haunting CRT Terminal Web UI** (`docs/index.html`)
  - Dual Amber (P20) / Green (P31) phosphor rendering.
  - Live assembler, step debugger, hex memory inspector, and terminal output.

- [x] **Task 8: Devpost Media & Submission Deliverables**
  - Generate promotional banner `assets/thumbnail_1280x800.png`.
  - Produce cinematic demo video `assets/demo_kiroween_1080p.mp4` using FFmpeg.
  - Write complete Devpost submission document `DEVPOST_KIROWEEN_SUBMISSION.md`.
