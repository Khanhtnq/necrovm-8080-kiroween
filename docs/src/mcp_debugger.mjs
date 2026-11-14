/**
 * NecroVM 8080 - Model Context Protocol (MCP) Debugger Interface
 * Stitches the 1974 Intel 8080 core to 2026 AI Agent tool calls over JSON-RPC 2.0.
 */

import { Intel8080 } from './cpu8080.mjs';
import { CpmBdos } from './cpm_bdos.mjs';
import { Assembler8080 } from './assembler8080.mjs';

export class NecroMcpDebugger {
  constructor() {
    this.cpu = new Intel8080();
    this.bdos = new CpmBdos(this.cpu);
    this.assembler = new Assembler8080();
    this.breakpoints = new Set();
  }

  getToolDefinitions() {
    return [
      {
        name: 'necro_inspect_registers',
        description: 'Returns the current state of all Intel 8080 registers (A, B, C, D, E, H, L, SP, PC, PSW flags, elapsed cycles)',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'necro_step_cycles',
        description: 'Executes instructions until stepCount instructions complete, a breakpoint hits, or CPU halts',
        inputSchema: {
          type: 'object',
          properties: {
            steps: { type: 'integer', description: 'Number of instructions to execute', default: 1 }
          }
        }
      },
      {
        name: 'necro_set_breakpoint',
        description: 'Sets or clears a memory address execution breakpoint',
        inputSchema: {
          type: 'object',
          properties: {
            address: { type: 'integer', description: 'Memory address 0x0000 - 0xFFFF' },
            enabled: { type: 'boolean', description: 'True to set, False to clear', default: true }
          },
          required: ['address']
        }
      },
      {
        name: 'necro_read_memory_dump',
        description: 'Reads a contiguous block of virtual 8080 RAM as hex and ASCII',
        inputSchema: {
          type: 'object',
          properties: {
            address: { type: 'integer', description: 'Start memory address' },
            length: { type: 'integer', description: 'Byte length (max 256)', default: 64 }
          },
          required: ['address']
        }
      },
      {
        name: 'necro_assemble_and_load',
        description: 'Assembles Intel 8080 assembly code and loads it directly into virtual RAM at 0x0100',
        inputSchema: {
          type: 'object',
          properties: {
            sourceCode: { type: 'string', description: 'Intel 8080 assembly text' }
          },
          required: ['sourceCode']
        }
      }
    ];
  }

  handleToolCall(name, args = {}) {
    switch (name) {
      case 'necro_inspect_registers': {
        return {
          registers: {
            A: `0x${this.cpu.a.toString(16).padStart(2, '0').toUpperCase()}`,
            B: `0x${this.cpu.b.toString(16).padStart(2, '0').toUpperCase()}`,
            C: `0x${this.cpu.c.toString(16).padStart(2, '0').toUpperCase()}`,
            D: `0x${this.cpu.d.toString(16).padStart(2, '0').toUpperCase()}`,
            E: `0x${this.cpu.e.toString(16).padStart(2, '0').toUpperCase()}`,
            H: `0x${this.cpu.h.toString(16).padStart(2, '0').toUpperCase()}`,
            L: `0x${this.cpu.l.toString(16).padStart(2, '0').toUpperCase()}`,
            SP: `0x${this.cpu.sp.toString(16).padStart(4, '0').toUpperCase()}`,
            PC: `0x${this.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`,
            PSW: `0x${this.cpu.getPSW().toString(16).padStart(4, '0').toUpperCase()}`,
          },
          flags: {
            Sign: Boolean(this.cpu.flags.s),
            Zero: Boolean(this.cpu.flags.z),
            AuxCarry: Boolean(this.cpu.flags.ac),
            Parity: Boolean(this.cpu.flags.p),
            Carry: Boolean(this.cpu.flags.cy)
          },
          state: {
            halted: this.cpu.halted,
            cycles: this.cpu.cycles.toString(),
            interruptsEnabled: this.cpu.interruptsEnabled
          },
          consoleOutput: this.bdos.getConsoleOutput()
        };
      }

      case 'necro_step_cycles': {
        const steps = args.steps || 1;
        let executed = 0;
        let hitBreakpoint = false;

        for (let i = 0; i < steps; i++) {
          if (this.cpu.halted) break;
          if (i > 0 && this.breakpoints.has(this.cpu.pc)) {
            hitBreakpoint = true;
            break;
          }
          this.cpu.step();
          executed++;
        }

        return {
          executedSteps: executed,
          currentPC: `0x${this.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`,
          halted: this.cpu.halted,
          hitBreakpoint,
          consoleOutput: this.bdos.getConsoleOutput()
        };
      }

      case 'necro_set_breakpoint': {
        const addr = args.address & 0xffff;
        const enabled = args.enabled !== false;
        if (enabled) {
          this.breakpoints.add(addr);
        } else {
          this.breakpoints.delete(addr);
        }
        return {
          address: `0x${addr.toString(16).padStart(4, '0').toUpperCase()}`,
          active: enabled,
          totalBreakpoints: this.breakpoints.size
        };
      }

      case 'necro_read_memory_dump': {
        const addr = args.address & 0xffff;
        const length = Math.min(Math.max(1, args.length || 64), 256);
        const hex = [];
        let ascii = '';

        for (let i = 0; i < length; i++) {
          const byte = this.cpu.readByte(addr + i);
          hex.push(byte.toString(16).padStart(2, '0').toUpperCase());
          ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        }

        return {
          startAddress: `0x${addr.toString(16).padStart(4, '0').toUpperCase()}`,
          length,
          hex: hex.join(' '),
          ascii
        };
      }

      case 'necro_assemble_and_load': {
        const result = this.assembler.assemble(args.sourceCode);
        for (const item of result.bytes) {
          this.cpu.writeByte(item.address, item.byte);
        }
        this.cpu.pc = result.entryPoint;
        this.cpu.halted = false;

        return {
          status: 'success',
          bytesEmitted: result.bytes.length,
          entryPoint: `0x${result.entryPoint.toString(16).padStart(4, '0').toUpperCase()}`,
          symbols: result.symbols
        };
      }

      default:
        throw new Error(`Unknown MCP Tool: ${name}`);
    }
  }

  // Handle standard JSON-RPC 2.0 messages over Stdio
  handleJsonRpc(request) {
    if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: this.getToolDefinitions()
        }
      };
    }

    if (request.method === 'tools/call') {
      try {
        const toolResult = this.handleToolCall(request.params.name, request.params.arguments);
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2)
              }
            ]
          }
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32000,
            message: err.message
          }
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: 'Method not found' }
    };
  }
}

// Stdio CLI listener when executed directly
if (process.argv[1] && process.argv[1].endsWith('mcp_debugger.mjs')) {
  const debuggerInstance = new NecroMcpDebugger();
  let buffer = '';

  process.stdin.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep remainder

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const req = JSON.parse(line.trim());
        const res = debuggerInstance.handleJsonRpc(req);
        process.stdout.write(JSON.stringify(res) + '\n');
      } catch (e) {
        // invalid json
      }
    }
  });
}
