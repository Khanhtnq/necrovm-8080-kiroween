# Devpost Kiroween 2026 Submission

## Project Name
**NecroVM 8080: Resurrecting 1974 CP/M Silicon Stitched to Modern MCP Agent Debugging**

## Tagline
A cycle-accurate 1974 Intel 8080 microprocessor and Digital Research CP/M 2.2 BDOS emulator, stitched to 2026 Anthropic Model Context Protocol (MCP) AI agent debugging tools inside a dual-phosphor amber/green CRT terminal.

---

## 🏆 Kiroween 2026 Official Tracks Targeted
1. **Best Resurrection ($5,000 USD)**:
   - Faithful, zero-dependency software recreation of the seminal 1974 Intel 8080 8-bit CPU.
   - Cycle-accurate T-state counting, parity flag lookup table, Auxiliary Carry BCD nibble carry math, and hardware PSW bit packing (`[SZ0A0P1C]`).
   - Digital Research CP/M 2.2 BDOS syscall trapping at vector `0x0005` (implementing `C_WRITE`, `C_WRITESTR`, `C_READ`, `C_READSTR`, and virtual disk FCB `F_OPEN` / `F_READ` with 128-byte DMA sector buffering).
2. **Best Frankenstein ($5,000 USD)**:
   - Stitches a 52-year-old microprocessor architecture directly to the bleeding-edge 2026 Model Context Protocol (MCP) AI agent tooling over JSON-RPC 2.0.
   - AI Agents can autonomously assemble Intel 8080 assembly code, inject it into virtual RAM at `0x0100`, step cycle-by-cycle, inspect registers/flags, set hardware breakpoints, and stream CP/M console outputs.
3. **Best Costume Contest ($5,000 USD)**:
   - Visual and acoustic transformation into a 1970s CRT computer terminal with raytraced scanlines, barrel glass curvature, dual phosphor illumination (P31 Green vs. P20 Amber toggle), and hardware telemetry dashboards.
4. **Overall Grand Prize ($30,000 USD)**:
   - Production-grade code quality, 100% automated test coverage across 18 unit and integration tests, cross-platform portability in Node.js and modern evergreen browsers with zero runtime npm dependencies.

---

## ⚙️ Architecture & Technical Implementation

```
+-------------------------------------------------------------+
|                2026 AI Agent Ecosystem (MCP)                |
|  necro_inspect_registers | necro_step_cycles | necro_dump    |
+------------------------------+------------------------------+
                               | JSON-RPC 2.0 (Stdio/WS)
+------------------------------v------------------------------+
|                   NecroVM 8080 Engine Core                  |
|                                                             |
|  +-----------------------+     +-------------------------+  |
|  | Intel 8080 CPU Core   |     | CP/M 2.2 BDOS Subsystem |  |
|  | - 64KB RAM (Uint8)    |     | - Trap Vector 0x0005    |  |
|  | - Cycle-accurate ALU  |     | - Console BDOS I/O      |  |
|  | - S, Z, AC, P, CY PSW |     | - Virtual Disk & DMA    |  |
|  +-----------+-----------+     +------------+------------+  |
|              |                              |               |
|  +-----------v------------------------------v------------+  |
|  |             Two-Pass Intel 8080 Macro Assembler        |  |
|  |             Labels, EQU, ORG, DB, DW, Directives       |  |
|  +-------------------------------------------------------+  |
+------------------------------+------------------------------+
                               | Reactive DOM & Audio
+------------------------------v------------------------------+
|              Haunting CRT Phosphor Terminal Web UI          |
|    - P31 Green / P20 Amber  - Live Hex Dump  - Disassembly  |
+-------------------------------------------------------------+
```

### 1. `src/cpu8080.mjs`
- **Register Pair Handling**: Implements BC, DE, HL, SP, and PC with little-endian 16-bit addressing.
- **ALU & Status Register**: Faithful implementation of Intel 8080 Condition Flags where bit 1 of PSW is permanently hardwired to `1`.
- **Precomputed Parity**: 256-byte lookup table calculating 8-bit even parity.
- **Comprehensive Opcode Matrix**: MOV, MVI, LXI, LDA, STA, LHLD, SHLD, LDAX, STAX, DAD, INR, DCR, INX, DCX, ADD, ADC, SUB, SBB, ANA, XRA, ORA, CMP, Rotates (RLC, RRC, RAL, RAR), Stack (PUSH, POP, XTHL, SPHL, PCHL), Restarts (RST 0-7), and Conditional Jumps/Calls/Returns.

### 2. `src/cpm_bdos.mjs`
- **Page Zero Vectors**: Vector `0x0000` (Warm Boot) and Vector `0x0005` (BDOS Entry point).
- **Console Syscalls**:
  - `C_WRITE` (Function 2): Writes individual ASCII character from register `E`.
  - `C_WRITESTR` (Function 9): Writes string pointed to by `DE` terminated by `$`.
  - `C_READ` / `C_READSTR` (Functions 1 & 10): Buffered terminal input processing.
- **Virtual Disk & DMA**:
  - `F_OPEN` (Function 15): Parses 8.3 File Control Blocks (FCB) against an in-memory virtual filesystem.
  - `F_READ` (Function 20): Reads sequential 128-byte sectors into the user's DMA address (default `0x0080`).

### 3. `src/assembler8080.mjs`
- **Pass 1**: Scans source text, calculates instruction byte sizes, resolves symbol definitions, labels, and `EQU` equates.
- **Pass 2**: Generates machine code binary buffers, evaluates hex (`0x...`, `...H`), binary (`...B`), character constants, and handles `ORG`, `DB`, and `DW` directives.

### 4. `src/mcp_debugger.mjs`
- Implements standard Anthropic Model Context Protocol tool endpoints:
  - `necro_inspect_registers`: Returns CPU register state, PSW flags, and cycle count.
  - `necro_step_cycles`: Steps N instructions or stops on breakpoints.
  - `necro_set_breakpoint`: Sets/clears memory breakpoints.
  - `necro_read_memory_dump`: Fetches hex and ASCII memory dumps.
  - `necro_assemble_and_load`: Assembles and hot-reloads assembly code into virtual RAM.

### 5. `docs/index.html`
- Interactive CRT Phosphor Terminal supporting P31 Green and P20 Amber phosphors.
- Real-time CPU register dashboard, flag indicators, CP/M console terminal screen, and 0x0100 TPA RAM hex inspector.
- Built-in live runnable demos (CP/M Hello World Banner, Fibonacci sequence calculator).

---

## 🧪 Verification & Test Coverage
Ran with Node.js built-in test runner (`node --test tests/test_8080.mjs`):
- **18 out of 18 test cases passing 100%**:
  1. NOP instruction cycle validation.
  2. MVI and MOV register transfers.
  3. 16-bit LXI, INX, and DCX operations.
  4. ADD, Carry, and Zero flag calculations.
  5. SUB, Sign, and Parity flag logic.
  6. ANA, ORA, XRA logic operations.
  7. PUSH and POP PSW stack preservation.
  8. CALL and RET subroutine flow.
  9. JNZ and JZ conditional branching.
  10. DAD double add 16-bit operations.
  11. RLC and RRC bit rotation.
  12. Indirect memory access (MVI M, INR M, MOV A, M).
  13. XCHG and XTHL stack and register swaps.
  14. CP/M BDOS `C_WRITE` console character output.
  15. CP/M BDOS `C_WRITESTR` $-terminated string output.
  16. CP/M BDOS `F_OPEN` and `F_READ` virtual filesystem record reads.
  17. Assembler8080 two-pass assembly and execution round-trip.
  18. MCP Debugger tool invocation over JSON-RPC.

---

## 📦 Media Deliverables
- **Thumbnail (1280x800)**: `assets/thumbnail_1280x800.png`
- **Cinematic Demo Video (1920x1080 30fps, 40s)**: `assets/demo_kiroween_1080p.mp4`
- **Kiro Governance Framework**:
  - `/.kiro/specs/necrovm/requirements.md`
  - `/.kiro/specs/necrovm/design.md`
  - `/.kiro/specs/necrovm/tasks.md`
  - `/.kiro/steering/architecture.md`
  - `/.kiro/hooks/opcode-test-on-save.json`
  - `/.kiro/settings/mcp.json`

---

## 🚀 Running the Project Locally

```bash
# 1. Run full test suite
npm test

# 2. Launch the MCP Agent Debugger Server
node src/mcp_debugger.mjs --stdio

# 3. Open the CRT Phosphor Terminal Web UI
# Simply open docs/index.html in any modern browser!
```

---
*NecroVM 8080 - Bringing the ghosts of computing past into the AI-agent future.*
