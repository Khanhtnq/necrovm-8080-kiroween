/**
 * NecroVM 8080 Comprehensive Verification Suite
 * Tests Intel 8080 Opcode Execution, PSW Flags (S, Z, AC, P, CY),
 * Call/Return Stack dynamics, CP/M 2.2 BDOS syscalls, and Assembler round-trip.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Intel8080 } from '../src/cpu8080.mjs';
import { CpmBdos } from '../src/cpm_bdos.mjs';
import { Assembler8080 } from '../src/assembler8080.mjs';
import { NecroMcpDebugger } from '../src/mcp_debugger.mjs';

describe('Intel 8080 CPU Core Test Suite', () => {

  test('Test 01: NOP instruction advances PC and consumes 4 cycles', () => {
    const cpu = new Intel8080();
    cpu.memory[0x0000] = 0x00; // NOP
    const cycles = cpu.step();
    assert.equal(cycles, 4);
    assert.equal(cpu.pc, 1);
    assert.equal(cpu.cycles, 4n);
  });

  test('Test 02: MVI and MOV register transfers', () => {
    const cpu = new Intel8080();
    cpu.memory[0x0000] = 0x06; // MVI B, 0x42
    cpu.memory[0x0001] = 0x42;
    cpu.memory[0x0002] = 0x78; // MOV A, B
    cpu.step();
    assert.equal(cpu.b, 0x42);
    cpu.step();
    assert.equal(cpu.a, 0x42);
  });

  test('Test 03: 16-bit LXI, INX, DCX operations', () => {
    const cpu = new Intel8080();
    cpu.memory[0x0000] = 0x21; // LXI H, 0x1234
    cpu.memory[0x0001] = 0x34;
    cpu.memory[0x0002] = 0x12;
    cpu.memory[0x0003] = 0x23; // INX H
    cpu.memory[0x0004] = 0x2b; // DCX H
    cpu.step();
    assert.equal(cpu.getHL(), 0x1234);
    cpu.step();
    assert.equal(cpu.getHL(), 0x1235);
    cpu.step();
    assert.equal(cpu.getHL(), 0x1234);
  });

  test('Test 04: ADD, Carry, and Zero Flag Calculation', () => {
    const cpu = new Intel8080();
    cpu.a = 0xff;
    cpu.b = 0x01;
    cpu.memory[0x0000] = 0x80; // ADD B
    cpu.step();
    assert.equal(cpu.a, 0x00);
    assert.equal(cpu.flags.z, 1);
    assert.equal(cpu.flags.cy, 1);
    assert.equal(cpu.flags.s, 0);
  });

  test('Test 05: SUB, Sign Flag, and Parity Flag', () => {
    const cpu = new Intel8080();
    cpu.a = 0x10;
    cpu.b = 0x20;
    cpu.memory[0x0000] = 0x90; // SUB B
    cpu.step();
    assert.equal(cpu.a, 0xf0); // 16 - 32 = -16 = 0xF0
    assert.equal(cpu.flags.s, 1);
    assert.equal(cpu.flags.cy, 1);
    // 0xF0 has 4 ones -> even parity -> P = 1
    assert.equal(cpu.flags.p, 1);
  });

  test('Test 06: Logic Operations: ANA, ORA, XRA', () => {
    const cpu = new Intel8080();
    cpu.a = 0xaa;
    cpu.b = 0x55;
    cpu.memory[0x0000] = 0xa8; // XRA B -> 0xFF
    cpu.memory[0x0001] = 0xb0; // ORA B -> 0xFF
    cpu.memory[0x0002] = 0xa0; // ANA B -> 0x55
    cpu.step();
    assert.equal(cpu.a, 0xff);
    cpu.step();
    assert.equal(cpu.a, 0xff);
    cpu.step();
    assert.equal(cpu.a, 0x55);
  });

  test('Test 07: Stack Operations: PUSH and POP PSW', () => {
    const cpu = new Intel8080();
    cpu.sp = 0x2000;
    cpu.a = 0xfe;
    cpu.flags.cy = 1;
    cpu.flags.z = 1;
    cpu.flags.s = 1;
    cpu.memory[0x0000] = 0xf5; // PUSH PSW
    cpu.memory[0x0001] = 0xf1; // POP PSW
    cpu.step();
    assert.equal(cpu.sp, 0x1ffe);
    // Alter A and flags
    cpu.a = 0x00;
    cpu.flags.cy = 0;
    cpu.step();
    assert.equal(cpu.sp, 0x2000);
    assert.equal(cpu.a, 0xfe);
    assert.equal(cpu.flags.cy, 1);
    assert.equal(cpu.flags.z, 1);
  });

  test('Test 08: CALL and RET Subroutine Flow', () => {
    const cpu = new Intel8080();
    cpu.sp = 0x1000;
    cpu.memory[0x0000] = 0xcd; // CALL 0x0500
    cpu.memory[0x0001] = 0x00;
    cpu.memory[0x0002] = 0x05;
    cpu.memory[0x0500] = 0xc9; // RET
    cpu.step();
    assert.equal(cpu.pc, 0x0500);
    assert.equal(cpu.sp, 0x0ffe);
    cpu.step();
    assert.equal(cpu.pc, 0x0003);
    assert.equal(cpu.sp, 0x1000);
  });

  test('Test 09: Conditional Branching: JNZ vs JZ', () => {
    const cpu = new Intel8080();
    cpu.flags.z = 0;
    cpu.memory[0x0000] = 0xc2; // JNZ 0x0800
    cpu.memory[0x0001] = 0x00;
    cpu.memory[0x0002] = 0x08;
    cpu.step();
    assert.equal(cpu.pc, 0x0800);

    // Now test untaken branch
    cpu.flags.z = 0;
    cpu.memory[0x0800] = 0xca; // JZ 0x0900
    cpu.memory[0x0801] = 0x00;
    cpu.memory[0x0802] = 0x09;
    cpu.step();
    assert.equal(cpu.pc, 0x0803); // Not jumped
  });

  test('Test 10: DAD Double Add HL register pair', () => {
    const cpu = new Intel8080();
    cpu.setHL(0x1000);
    cpu.setBC(0x2000);
    cpu.memory[0x0000] = 0x09; // DAD B
    cpu.step();
    assert.equal(cpu.getHL(), 0x3000);
    assert.equal(cpu.flags.cy, 0);
  });

  test('Test 11: Rotates: RLC and RRC bit operations', () => {
    const cpu = new Intel8080();
    cpu.a = 0b10000001;
    cpu.memory[0x0000] = 0x07; // RLC
    cpu.step();
    assert.equal(cpu.a, 0b00000011);
    assert.equal(cpu.flags.cy, 1);

    cpu.memory[0x0001] = 0x0f; // RRC
    cpu.step();
    assert.equal(cpu.a, 0b10000001);
    assert.equal(cpu.flags.cy, 1);
  });

  test('Test 12: Memory Indirect Operations: MVI M, INR M, MOV A, M', () => {
    const cpu = new Intel8080();
    cpu.setHL(0x2050);
    cpu.memory[0x0000] = 0x36; // MVI M, 0x77
    cpu.memory[0x0001] = 0x77;
    cpu.memory[0x0002] = 0x34; // INR M
    cpu.memory[0x0003] = 0x7e; // MOV A, M
    cpu.step();
    assert.equal(cpu.readByte(0x2050), 0x77);
    cpu.step();
    assert.equal(cpu.readByte(0x2050), 0x78);
    cpu.step();
    assert.equal(cpu.a, 0x78);
  });

  test('Test 13: XCHG and XTHL exchange operations', () => {
    const cpu = new Intel8080();
    cpu.setHL(0x1122);
    cpu.setDE(0x3344);
    cpu.sp = 0x3000;
    cpu.writeWord(0x3000, 0x5566);
    cpu.memory[0x0000] = 0xeb; // XCHG
    cpu.memory[0x0001] = 0xe3; // XTHL
    cpu.step();
    assert.equal(cpu.getHL(), 0x3344);
    assert.equal(cpu.getDE(), 0x1122);
    cpu.step();
    assert.equal(cpu.getHL(), 0x5566);
    assert.equal(cpu.readWord(0x3000), 0x3344);
  });

  test('Test 14: CP/M 2.2 BDOS Function 2 (C_WRITE) Console Character Output', () => {
    const cpu = new Intel8080();
    const bdos = new CpmBdos(cpu);
    cpu.sp = 0xf000;
    // Set C = 2, E = 'H', CALL 0x0005
    cpu.c = 2;
    cpu.e = 'H'.charCodeAt(0);
    cpu.push(0x0100);
    cpu.pc = 0x0005;
    cpu.step();
    assert.equal(bdos.getConsoleOutput(), 'H');
  });

  test('Test 15: CP/M 2.2 BDOS Function 9 (C_WRITESTR) Console String Output', () => {
    const cpu = new Intel8080();
    const bdos = new CpmBdos(cpu);
    cpu.sp = 0xf000;
    // Store string "NECROVM 8080$" at 0x0200
    const str = 'NECROVM 8080$';
    for (let i = 0; i < str.length; i++) {
      cpu.writeByte(0x0200 + i, str.charCodeAt(i));
    }
    cpu.c = 9;
    cpu.setDE(0x0200);
    cpu.push(0x0100);
    cpu.pc = 0x0005;
    cpu.step();
    assert.equal(bdos.getConsoleOutput(), 'NECROVM 8080');
  });

  test('Test 16: CP/M 2.2 BDOS Function 15 & 20 Virtual Filesystem F_OPEN & F_READ', () => {
    const cpu = new Intel8080();
    const bdos = new CpmBdos(cpu);
    cpu.sp = 0xf000;

    // Create virtual file TEST.TXT with 256 bytes (2 CP/M records)
    const content = 'A'.repeat(128) + 'B'.repeat(128);
    bdos.createVirtualFile('TEST.TXT', content);

    // Prepare FCB at 0x0300
    // Drive 0, 'TEST    ', 'TXT'
    cpu.writeByte(0x0300, 0);
    const nameExt = 'TEST    TXT';
    for (let i = 0; i < 11; i++) {
      cpu.writeByte(0x0301 + i, nameExt.charCodeAt(i));
    }

    // Call F_OPEN (fn 15)
    cpu.c = 15;
    cpu.setDE(0x0300);
    cpu.push(0x0100);
    cpu.pc = 0x0005;
    cpu.step();
    assert.equal(cpu.a, 0x00); // 0 = success

    // Set DMA to 0x0400 (fn 26)
    cpu.c = 26;
    cpu.setDE(0x0400);
    cpu.push(0x0100);
    cpu.pc = 0x0005;
    cpu.step();

    // Read Record 1 (fn 20)
    cpu.c = 20;
    cpu.setDE(0x0300);
    cpu.push(0x0100);
    cpu.pc = 0x0005;
    cpu.step();
    assert.equal(cpu.a, 0x00);
    assert.equal(cpu.readByte(0x0400), 'A'.charCodeAt(0));

    // Read Record 2 (fn 20)
    cpu.c = 20;
    cpu.setDE(0x0300);
    cpu.push(0x0100);
    cpu.pc = 0x0005;
    cpu.step();
    assert.equal(cpu.a, 0x00);
    assert.equal(cpu.readByte(0x0400), 'B'.charCodeAt(0));
  });

  test('Test 17: Assembler8080 Two-Pass Assembly and Round-trip Execution', () => {
    const asm = new Assembler8080();
    const cpu = new Intel8080();
    const bdos = new CpmBdos(cpu);

    const source = `
      ORG 0100H
      START:
        MVI C, 9
        LXI D, MSG
        CALL 0005H
        HLT
      MSG:
        DB 'KIROWEEN RESURRECTION 1974$'
    `;

    const result = asm.assemble(source);
    assert.ok(result.bytes.length > 0);
    assert.equal(result.symbols['START'], 0x0100);

    // Load into CPU RAM
    for (const item of result.bytes) {
      cpu.writeByte(item.address, item.byte);
    }

    cpu.pc = 0x0100;
    cpu.sp = 0xfffe;

    // Run until HLT
    let safety = 1000;
    while (!cpu.halted && safety-- > 0) {
      cpu.step();
    }

    assert.equal(cpu.halted, true);
    assert.equal(bdos.getConsoleOutput(), 'KIROWEEN RESURRECTION 1974');
  });

  test('Test 18: Model Context Protocol (MCP) Debugger Tool Integration', () => {
    const debuggerInstance = new NecroMcpDebugger();

    // Load assembly program via MCP tool
    const loadResult = debuggerInstance.handleToolCall('necro_assemble_and_load', {
      sourceCode: `
        ORG 0100H
        LXI B, 1234H
        MVI A, 42H
        HLT
      `
    });
    assert.equal(loadResult.status, 'success');

    // Inspect registers before step
    const regBefore = debuggerInstance.handleToolCall('necro_inspect_registers');
    assert.equal(regBefore.registers.PC, '0x0100');

    // Step 2 instructions
    const stepResult = debuggerInstance.handleToolCall('necro_step_cycles', { steps: 2 });
    assert.equal(stepResult.executedSteps, 2);

    // Verify registers updated
    const regAfter = debuggerInstance.handleToolCall('necro_inspect_registers');
    assert.equal(regAfter.registers.B, '0x12');
    assert.equal(regAfter.registers.C, '0x34');
    assert.equal(regAfter.registers.A, '0x42');

    // Read memory dump
    const dump = debuggerInstance.handleToolCall('necro_read_memory_dump', {
      address: 0x0100,
      length: 6
    });
    assert.equal(dump.length, 6);
    assert.ok(dump.hex.includes('01 34 12')); // LXI B, 1234H
  });

});
