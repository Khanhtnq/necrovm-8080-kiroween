# NecroVM 8080 - Requirements Specification

## 1. Project Overview
NecroVM 8080 resurrects the legendary 1974 Intel 8080 8-bit microprocessor, pairing historical silicon accuracy with 2026 Model Context Protocol (MCP) agent debugging capabilities and a retro CRT phosphor terminal UI.

## 2. Kiroween 2026 Target Tracks
- **Best Resurrection ($5,000)**: Faithful restoration of 1974 Intel 8080 architecture, instruction timing, parity flags, and Digital Research CP/M 2.2 BDOS syscall emulation.
- **Best Frankenstein ($5,000)**: Radical stitching of a 52-year-old microprocessor core to bleeding-edge 2026 MCP (Model Context Protocol) AI agent tooling via JSON-RPC 2.0 tool endpoints.
- **Best Costume Contest ($5,000)**: Visual and acoustic dressing featuring dual amber/green CRT phosphor glow, scanline raytracing, terminal barrel curvature, and audio keyclick feedback.
- **Overall Grand Prize ($30,000)**: Complete system integration, zero external runtime dependencies, 100% automated test coverage.

## 3. Functional Requirements
1. **CPU Emulation (`src/cpu8080.mjs`)**:
   - 64KB address space, 8-bit registers (A, B, C, D, E, H, L), 16-bit register pairs (BC, DE, HL, SP, PC).
   - Intel 8080 Condition Flags: Sign (S), Zero (Z), Auxiliary Carry (AC), Parity (P), Carry (CY).
   - Intel 8080 instruction set: Data transfer (MOV, MVI, LXI, LDA, STA, LHLD, SHLD, LDAX, STAX, XCHG), Arithmetic/Logic (ADD, ADI, ADC, ACI, SUB, SUI, SBB, SBI, INR, DCR, INX, DCX, DAD, ANA, ANI, ORA, ORI, XRA, XRI, CMP, CPI), Branching (JMP, Jcc, CALL, Ccc, RET, Rcc, RST), Stack/Machine (PUSH, POP, XTHL, SPHL, PCHL, EI, DI, HLT, NOP).
   - Exact T-state cycle counting per instruction.

2. **CP/M 2.2 BDOS Syscalls (`src/cpm_bdos.mjs`)**:
   - Trap address `0x0005` with register `C` function dispatch.
   - Function 2 (`C_WRITE`): Console character output (E register).
   - Function 9 (`C_WRITESTR`): Console string output terminated by `$`.
   - Function 1 (`C_READ`): Console character input.
   - Function 10 (`C_READSTR`): Buffered console input.
   - Function 15 (`F_OPEN`): File open emulation against virtual FAT/CPM filesystem.
   - Function 20 (`F_READ`): Sequential record read emulation (128-byte DMA sector buffer).

3. **Two-Pass 8080 Assembler (`src/assembler8080.mjs`)**:
   - Parses Intel 8080 mnemonics, labels, `ORG`, `DB`, `DW`, `DS`, and `EQU` directives.
   - Produces raw binary bytecode mapped to virtual memory starting at `0x0100` (CP/M TPA).

4. **MCP Debugger Interface (`src/mcp_debugger.mjs`)**:
   - Implements MCP schema tools: `necro_inspect_registers`, `necro_step_cycles`, `necro_set_breakpoint`, `necro_read_memory_dump`, `necro_assemble_and_load`.
   - Standard JSON-RPC 2.0 message handling for agent integration.

5. **Retro Phosphor CRT UI (`docs/index.html`)**:
   - Amber (P20) and Green (P31) phosphor toggle modes.
   - CRT scanline grid, bloom shaders, and bezel frame.
   - Live assembly editor, register dashboard, disassembler view, memory hex viewer, and I/O terminal console.
