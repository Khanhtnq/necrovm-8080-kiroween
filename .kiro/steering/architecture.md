# NecroVM Architecture Steering & Guidelines

## 1. Zero External Dependencies Policy
- Emulation core (`cpu8080.mjs`), CP/M layer (`cpm_bdos.mjs`), assembler (`assembler8080.mjs`), and MCP server (`mcp_debugger.mjs`) must run out-of-the-box in Node.js 18+ and modern evergreen browsers without requiring npm install or external libraries.

## 2. Silicon Truth (Intel 8080 Veracity)
- Bit 1 of PSW (Flags) is hardwired to 1 in real 8080 silicon.
- Parity is calculated across all 8 bits of the accumulator (even parity = 1, odd = 0).
- Auxiliary Carry (AC) handles BCD nibble carry from bit 3 to bit 4.
- Zero flag (Z) is set when result is 0; Sign flag (S) copies bit 7.

## 3. CP/M Memory Map
- `0x0000 - 0x0002`: Warm boot vector (`JMP 0xFA00`).
- `0x0005 - 0x0007`: BDOS entry point (`JMP 0xEC00`).
- `0x005C - 0x007F`: Default File Control Block (FCB 1 & 2).
- `0x0080 - 0x00FF`: Default DMA buffer / Command line tail.
- `0x0100 - 0xDC00`: Transient Program Area (TPA) for user binaries.
- `0xEC00 - 0xFA00`: NecroBDOS High Memory Syscall Interceptor.

## 4. MCP Agent Protocols
- Tools conform to Anthropic Model Context Protocol specification 2024-11-05.
- Responses must output clean JSON structured representations of register states, memory slices, and disassembled opcode instructions.
