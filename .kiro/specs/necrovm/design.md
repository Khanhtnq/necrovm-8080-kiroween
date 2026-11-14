# NecroVM 8080 - Architectural Design

## Architecture Overview
```
+-------------------------------------------------------+
|               Modern AI Agent Layer (MCP)             |
|  Tools: inspect_registers, step, set_breakpoint, dump  |
+---------------------------+---------------------------+
                            | JSON-RPC 2.0 / In-process
+---------------------------v---------------------------+
|               NecroVM Core Engine (ESM)               |
|                                                       |
|  +---------------------+    +----------------------+  |
|  | Intel 8080 CPU Core |    | CP/M 2.2 BDOS Trap   |  |
|  | - 64KB RAM Array    |    | - 0x0005 Call Interp |  |
|  | - PSW (Flags/Acc)   |    | - BDOS Syscalls      |  |
|  | - Cycle Counter     |    | - Virtual FS / DMA   |  |
|  +----------+----------+    +----------+-----------+  |
|             |                          |              |
|  +----------v--------------------------v-----------+  |
|  |        Two-Pass Intel 8080 Assembler           |  |
|  |        Labels, Directives (ORG, DB, DW, EQU)    |  |
|  +-------------------------------------------------+  |
+---------------------------+---------------------------+
                            | DOM / WebAudio Binding
+---------------------------v---------------------------+
|         Retro Phosphor CRT UI (Amber / Green)         |
|  - Real-time Hex Dump  - Disassembly  - Terminal I/O  |
+-------------------------------------------------------+
```

## Component Breakdown
1. **`Intel8080` Class**:
   - `registers`: `Uint8Array(7)` representing B, C, D, E, H, L, A.
   - `flags`: Sign, Zero, AuxCarry, Parity, Carry packed into 8-bit PSW format (`SZ0A0P1C`).
   - `pc`, `sp`: 16-bit program counter and stack pointer.
   - `memory`: `Uint8Array(65536)`.
   - `cycles`: Total elapsed T-states.
   - `parityTable`: Precomputed 256-entry boolean lookup table for 8080 parity flag.

2. **`CpmBdos` Class**:
   - Intercepts jumps/calls to `0x0005`.
   - Manages virtual disk drives (A:, B:) with directory blocks and 128-byte logical records.
   - Redirects output characters to an event callback consumed by terminal.

3. **`Assembler8080` Class**:
   - Pass 1: Symbol resolution, address calculation, label table generation.
   - Pass 2: Bytecode emission, immediate and address operand patching.

4. **`NecroMcpDebugger` Class**:
   - Exposes structured tool declarations conforming to Anthropic Model Context Protocol.
   - Methods: `handleRequest(rpc)` returning JSON-RPC formatted responses.
