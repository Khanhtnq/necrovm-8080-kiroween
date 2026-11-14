/**
 * NecroVM 8080 - Intel 8080 8-bit Microprocessor Core
 * Cycle-accurate emulation of registers, ALU flags, 64KB RAM, and opcode dispatch.
 */

// Precompute 256-entry even parity lookup table for 8080 PSW
const PARITY_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let bits = 0;
  for (let b = 0; b < 8; b++) {
    if ((i >> b) & 1) bits++;
  }
  PARITY_TABLE[i] = (bits % 2 === 0) ? 1 : 0;
}

export class Intel8080 {
  constructor() {
    // 64 Kilobytes RAM
    this.memory = new Uint8Array(65536);

    // 8-bit General Registers
    this.a = 0; // Accumulator
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.h = 0;
    this.l = 0;

    // 16-bit Pointers
    this.sp = 0;
    this.pc = 0;

    // 8080 Flags: S (Sign), Z (Zero), AC (Aux Carry), P (Parity), CY (Carry)
    // Bit layout of PSW: [S, Z, 0, AC, 0, P, 1, CY]
    this.flags = {
      s: 0,
      z: 0,
      ac: 0,
      p: 0,
      cy: 0,
    };

    // Machine state
    this.halted = false;
    this.cycles = 0n; // Total elapsed T-states
    this.interruptsEnabled = false;

    // Optional I/O bus and BDOS traps
    this.ioIn = (port) => 0xff;
    this.ioOut = (port, value) => {};
    this.bdosTrap = null;
  }

  reset() {
    this.a = 0;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.h = 0;
    this.l = 0;
    this.sp = 0;
    this.pc = 0;
    this.flags = { s: 0, z: 0, ac: 0, p: 0, cy: 0 };
    this.halted = false;
    this.cycles = 0n;
    this.interruptsEnabled = false;
  }

  // 16-bit Register Pair Helpers
  getBC() { return (this.b << 8) | this.c; }
  setBC(val) {
    this.b = (val >> 8) & 0xff;
    this.c = val & 0xff;
  }

  getDE() { return (this.d << 8) | this.e; }
  setDE(val) {
    this.d = (val >> 8) & 0xff;
    this.e = val & 0xff;
  }

  getHL() { return (this.h << 8) | this.l; }
  setHL(val) {
    this.h = (val >> 8) & 0xff;
    this.l = val & 0xff;
  }

  // PSW: Accumulator (high byte) + Flags (low byte)
  // Format: [S, Z, 0, AC, 0, P, 1, CY]
  getPSW() {
    let f = 0x02; // Bit 1 is always 1 on 8080
    if (this.flags.cy) f |= 0x01;
    if (this.flags.p)  f |= 0x04;
    if (this.flags.ac) f |= 0x10;
    if (this.flags.z)  f |= 0x40;
    if (this.flags.s)  f |= 0x80;
    return (this.a << 8) | f;
  }

  setPSW(val) {
    this.a = (val >> 8) & 0xff;
    const f = val & 0xff;
    this.flags.cy = (f & 0x01) ? 1 : 0;
    this.flags.p  = (f & 0x04) ? 1 : 0;
    this.flags.ac = (f & 0x10) ? 1 : 0;
    this.flags.z  = (f & 0x40) ? 1 : 0;
    this.flags.s  = (f & 0x80) ? 1 : 0;
  }

  // Memory access
  readByte(addr) {
    return this.memory[addr & 0xffff];
  }

  writeByte(addr, val) {
    this.memory[addr & 0xffff] = val & 0xff;
  }

  readWord(addr) {
    const low = this.readByte(addr);
    const high = this.readByte(addr + 1);
    return (high << 8) | low;
  }

  writeWord(addr, val) {
    this.writeByte(addr, val & 0xff);
    this.writeByte(addr + 1, (val >> 8) & 0xff);
  }

  // Stack operations
  push(val) {
    this.sp = (this.sp - 2) & 0xffff;
    this.writeWord(this.sp, val);
  }

  pop() {
    const val = this.readWord(this.sp);
    this.sp = (this.sp + 2) & 0xffff;
    return val;
  }

  // Flag calculators
  updateZSP(val) {
    const byte = val & 0xff;
    this.flags.z = (byte === 0) ? 1 : 0;
    this.flags.s = (byte & 0x80) ? 1 : 0;
    this.flags.p = PARITY_TABLE[byte];
  }

  // ALU Operations
  add(val, carry = 0) {
    const res = this.a + val + carry;
    this.flags.ac = ((this.a & 0x0f) + (val & 0x0f) + carry > 0x0f) ? 1 : 0;
    this.flags.cy = (res > 0xff) ? 1 : 0;
    this.a = res & 0xff;
    this.updateZSP(this.a);
  }

  sub(val, borrow = 0) {
    const res = this.a - val - borrow;
    this.flags.ac = ((this.a & 0x0f) - (val & 0x0f) - borrow < 0) ? 0 : 1; // 8080 AC is borrow logic
    this.flags.cy = (res < 0) ? 1 : 0;
    this.a = res & 0xff;
    this.updateZSP(this.a);
  }

  ana(val) {
    const res = this.a & val;
    this.flags.ac = (((this.a | val) & 0x08) !== 0) ? 1 : 0;
    this.flags.cy = 0;
    this.a = res & 0xff;
    this.updateZSP(this.a);
  }

  xra(val) {
    this.a = (this.a ^ val) & 0xff;
    this.flags.ac = 0;
    this.flags.cy = 0;
    this.updateZSP(this.a);
  }

  ora(val) {
    this.a = (this.a | val) & 0xff;
    this.flags.ac = 0;
    this.flags.cy = 0;
    this.updateZSP(this.a);
  }

  cmp(val) {
    const res = this.a - val;
    this.flags.ac = ((this.a & 0x0f) - (val & 0x0f) < 0) ? 0 : 1;
    this.flags.cy = (res < 0) ? 1 : 0;
    this.updateZSP(res & 0xff);
  }

  inr(val) {
    const res = (val + 1) & 0xff;
    this.flags.ac = ((val & 0x0f) + 1 > 0x0f) ? 1 : 0;
    this.updateZSP(res);
    return res;
  }

  dcr(val) {
    const res = (val - 1) & 0xff;
    this.flags.ac = ((val & 0x0f) === 0) ? 0 : 1;
    this.updateZSP(res);
    return res;
  }

  // Fetch next byte at PC
  fetchByte() {
    const byte = this.readByte(this.pc);
    this.pc = (this.pc + 1) & 0xffff;
    return byte;
  }

  // Fetch 16-bit word at PC (little-endian)
  fetchWord() {
    const word = this.readWord(this.pc);
    this.pc = (this.pc + 2) & 0xffff;
    return word;
  }

  // Execute single instruction
  step() {
    if (this.halted) return 4;

    // Check CP/M BDOS trap entry point at 0x0005
    if (this.pc === 0x0005 && this.bdosTrap) {
      const handled = this.bdosTrap(this);
      if (handled) return 10;
    }

    const pcBefore = this.pc;
    const op = this.fetchByte();
    let cycles = 4;

    switch (op) {
      // NOP
      case 0x00: cycles = 4; break;

      // LXI B, d16
      case 0x01: this.setBC(this.fetchWord()); cycles = 10; break;
      // STAX B
      case 0x02: this.writeByte(this.getBC(), this.a); cycles = 7; break;
      // INX B
      case 0x03: this.setBC((this.getBC() + 1) & 0xffff); cycles = 5; break;
      // INR B
      case 0x04: this.b = this.inr(this.b); cycles = 5; break;
      // DCR B
      case 0x05: this.b = this.dcr(this.b); cycles = 5; break;
      // MVI B, d8
      case 0x06: this.b = this.fetchByte(); cycles = 7; break;
      // RLC
      case 0x07: {
        const high = (this.a >> 7) & 1;
        this.flags.cy = high;
        this.a = ((this.a << 1) | high) & 0xff;
        cycles = 4;
        break;
      }

      // DAD B
      case 0x09: {
        const sum = this.getHL() + this.getBC();
        this.flags.cy = (sum > 0xffff) ? 1 : 0;
        this.setHL(sum & 0xffff);
        cycles = 10;
        break;
      }
      // LDAX B
      case 0x0a: this.a = this.readByte(this.getBC()); cycles = 7; break;
      // DCX B
      case 0x0b: this.setBC((this.getBC() - 1) & 0xffff); cycles = 5; break;
      // INR C
      case 0x0c: this.c = this.inr(this.c); cycles = 5; break;
      // DCR C
      case 0x0d: this.c = this.dcr(this.c); cycles = 5; break;
      // MVI C, d8
      case 0x0e: this.c = this.fetchByte(); cycles = 7; break;
      // RRC
      case 0x0f: {
        const low = this.a & 1;
        this.flags.cy = low;
        this.a = ((this.a >> 1) | (low << 7)) & 0xff;
        cycles = 4;
        break;
      }

      // LXI D, d16
      case 0x11: this.setDE(this.fetchWord()); cycles = 10; break;
      // STAX D
      case 0x12: this.writeByte(this.getDE(), this.a); cycles = 7; break;
      // INX D
      case 0x13: this.setDE((this.getDE() + 1) & 0xffff); cycles = 5; break;
      // INR D
      case 0x14: this.d = this.inr(this.d); cycles = 5; break;
      // DCR D
      case 0x15: this.d = this.dcr(this.d); cycles = 5; break;
      // MVI D, d8
      case 0x16: this.d = this.fetchByte(); cycles = 7; break;
      // RAL
      case 0x17: {
        const high = (this.a >> 7) & 1;
        this.a = ((this.a << 1) | this.flags.cy) & 0xff;
        this.flags.cy = high;
        cycles = 4;
        break;
      }

      // DAD D
      case 0x19: {
        const sum = this.getHL() + this.getDE();
        this.flags.cy = (sum > 0xffff) ? 1 : 0;
        this.setHL(sum & 0xffff);
        cycles = 10;
        break;
      }
      // LDAX D
      case 0x1a: this.a = this.readByte(this.getDE()); cycles = 7; break;
      // DCX D
      case 0x1b: this.setDE((this.getDE() - 1) & 0xffff); cycles = 5; break;
      // INR E
      case 0x1c: this.e = this.inr(this.e); cycles = 5; break;
      // DCR E
      case 0x1d: this.e = this.dcr(this.e); cycles = 5; break;
      // MVI E, d8
      case 0x1e: this.e = this.fetchByte(); cycles = 7; break;
      // RAR
      case 0x1f: {
        const low = this.a & 1;
        this.a = ((this.a >> 1) | (this.flags.cy << 7)) & 0xff;
        this.flags.cy = low;
        cycles = 4;
        break;
      }

      // LXI H, d16
      case 0x21: this.setHL(this.fetchWord()); cycles = 10; break;
      // SHLD a16
      case 0x22: this.writeWord(this.fetchWord(), this.getHL()); cycles = 16; break;
      // INX H
      case 0x23: this.setHL((this.getHL() + 1) & 0xffff); cycles = 5; break;
      // INR H
      case 0x24: this.h = this.inr(this.h); cycles = 5; break;
      // DCR H
      case 0x25: this.h = this.dcr(this.h); cycles = 5; break;
      // MVI H, d8
      case 0x26: this.h = this.fetchByte(); cycles = 7; break;
      // DAA
      case 0x27: {
        let adj = 0;
        if ((this.a & 0x0f) > 9 || this.flags.ac) adj |= 0x06;
        if (this.a > 0x99 || this.flags.cy) {
          adj |= 0x60;
          this.flags.cy = 1;
        }
        const res = this.a + adj;
        this.flags.ac = ((this.a & 0x0f) + (adj & 0x0f) > 0x0f) ? 1 : 0;
        this.a = res & 0xff;
        this.updateZSP(this.a);
        cycles = 4;
        break;
      }

      // DAD H
      case 0x29: {
        const sum = this.getHL() + this.getHL();
        this.flags.cy = (sum > 0xffff) ? 1 : 0;
        this.setHL(sum & 0xffff);
        cycles = 10;
        break;
      }
      // LHLD a16
      case 0x2a: this.setHL(this.readWord(this.fetchWord())); cycles = 16; break;
      // DCX H
      case 0x2b: this.setHL((this.getHL() - 1) & 0xffff); cycles = 5; break;
      // INR L
      case 0x2c: this.l = this.inr(this.l); cycles = 5; break;
      // DCR L
      case 0x2d: this.l = this.dcr(this.l); cycles = 5; break;
      // MVI L, d8
      case 0x2e: this.l = this.fetchByte(); cycles = 7; break;
      // CMA
      case 0x2f: this.a = (~this.a) & 0xff; cycles = 4; break;

      // LXI SP, d16
      case 0x31: this.sp = this.fetchWord(); cycles = 10; break;
      // STA a16
      case 0x32: this.writeByte(this.fetchWord(), this.a); cycles = 13; break;
      // INX SP
      case 0x33: this.sp = (this.sp + 1) & 0xffff; cycles = 5; break;
      // INR M
      case 0x34: {
        const hl = this.getHL();
        this.writeByte(hl, this.inr(this.readByte(hl)));
        cycles = 10;
        break;
      }
      // DCR M
      case 0x35: {
        const hl = this.getHL();
        this.writeByte(hl, this.dcr(this.readByte(hl)));
        cycles = 10;
        break;
      }
      // MVI M, d8
      case 0x36: this.writeByte(this.getHL(), this.fetchByte()); cycles = 10; break;
      // STC
      case 0x37: this.flags.cy = 1; cycles = 4; break;

      // DAD SP
      case 0x39: {
        const sum = this.getHL() + this.sp;
        this.flags.cy = (sum > 0xffff) ? 1 : 0;
        this.setHL(sum & 0xffff);
        cycles = 10;
        break;
      }
      // LDA a16
      case 0x3a: this.a = this.readByte(this.fetchWord()); cycles = 13; break;
      // DCX SP
      case 0x3b: this.sp = (this.sp - 1) & 0xffff; cycles = 5; break;
      // INR A
      case 0x3c: this.a = this.inr(this.a); cycles = 5; break;
      // DCR A
      case 0x3d: this.a = this.dcr(this.a); cycles = 5; break;
      // MVI A, d8
      case 0x3e: this.a = this.fetchByte(); cycles = 7; break;
      // CMC
      case 0x3f: this.flags.cy = this.flags.cy ? 0 : 1; cycles = 4; break;

      // MOV r1, r2 (0x40 - 0x7F)
      case 0x40: this.b = this.b; cycles = 5; break;
      case 0x41: this.b = this.c; cycles = 5; break;
      case 0x42: this.b = this.d; cycles = 5; break;
      case 0x43: this.b = this.e; cycles = 5; break;
      case 0x44: this.b = this.h; cycles = 5; break;
      case 0x45: this.b = this.l; cycles = 5; break;
      case 0x46: this.b = this.readByte(this.getHL()); cycles = 7; break;
      case 0x47: this.b = this.a; cycles = 5; break;

      case 0x48: this.c = this.b; cycles = 5; break;
      case 0x49: this.c = this.c; cycles = 5; break;
      case 0x4a: this.c = this.d; cycles = 5; break;
      case 0x4b: this.c = this.e; cycles = 5; break;
      case 0x4c: this.c = this.h; cycles = 5; break;
      case 0x4d: this.c = this.l; cycles = 5; break;
      case 0x4e: this.c = this.readByte(this.getHL()); cycles = 7; break;
      case 0x4f: this.c = this.a; cycles = 5; break;

      case 0x50: this.d = this.b; cycles = 5; break;
      case 0x51: this.d = this.c; cycles = 5; break;
      case 0x52: this.d = this.d; cycles = 5; break;
      case 0x53: this.d = this.e; cycles = 5; break;
      case 0x54: this.d = this.h; cycles = 5; break;
      case 0x55: this.d = this.l; cycles = 5; break;
      case 0x56: this.d = this.readByte(this.getHL()); cycles = 7; break;
      case 0x57: this.d = this.a; cycles = 5; break;

      case 0x58: this.e = this.b; cycles = 5; break;
      case 0x59: this.e = this.c; cycles = 5; break;
      case 0x5a: this.e = this.d; cycles = 5; break;
      case 0x5b: this.e = this.e; cycles = 5; break;
      case 0x5c: this.e = this.h; cycles = 5; break;
      case 0x5d: this.e = this.l; cycles = 5; break;
      case 0x5e: this.e = this.readByte(this.getHL()); cycles = 7; break;
      case 0x5f: this.e = this.a; cycles = 5; break;

      case 0x60: this.h = this.b; cycles = 5; break;
      case 0x61: this.h = this.c; cycles = 5; break;
      case 0x62: this.h = this.d; cycles = 5; break;
      case 0x63: this.h = this.e; cycles = 5; break;
      case 0x64: this.h = this.h; cycles = 5; break;
      case 0x65: this.h = this.l; cycles = 5; break;
      case 0x66: this.h = this.readByte(this.getHL()); cycles = 7; break;
      case 0x67: this.h = this.a; cycles = 5; break;

      case 0x68: this.l = this.b; cycles = 5; break;
      case 0x69: this.l = this.c; cycles = 5; break;
      case 0x6a: this.l = this.d; cycles = 5; break;
      case 0x6b: this.l = this.e; cycles = 5; break;
      case 0x6c: this.l = this.h; cycles = 5; break;
      case 0x6d: this.l = this.l; cycles = 5; break;
      case 0x6e: this.l = this.readByte(this.getHL()); cycles = 7; break;
      case 0x6f: this.l = this.a; cycles = 5; break;

      case 0x70: this.writeByte(this.getHL(), this.b); cycles = 7; break;
      case 0x71: this.writeByte(this.getHL(), this.c); cycles = 7; break;
      case 0x72: this.writeByte(this.getHL(), this.d); cycles = 7; break;
      case 0x73: this.writeByte(this.getHL(), this.e); cycles = 7; break;
      case 0x74: this.writeByte(this.getHL(), this.h); cycles = 7; break;
      case 0x75: this.writeByte(this.getHL(), this.l); cycles = 7; break;
      case 0x76: this.halted = true; cycles = 7; break; // HLT
      case 0x77: this.writeByte(this.getHL(), this.a); cycles = 7; break;

      case 0x78: this.a = this.b; cycles = 5; break;
      case 0x79: this.a = this.c; cycles = 5; break;
      case 0x7a: this.a = this.d; cycles = 5; break;
      case 0x7b: this.a = this.e; cycles = 5; break;
      case 0x7c: this.a = this.h; cycles = 5; break;
      case 0x7d: this.a = this.l; cycles = 5; break;
      case 0x7e: this.a = this.readByte(this.getHL()); cycles = 7; break;
      case 0x7f: this.a = this.a; cycles = 5; break;

      // Arithmetic / Logic (0x80 - 0xBF)
      case 0x80: this.add(this.b); cycles = 4; break;
      case 0x81: this.add(this.c); cycles = 4; break;
      case 0x82: this.add(this.d); cycles = 4; break;
      case 0x83: this.add(this.e); cycles = 4; break;
      case 0x84: this.add(this.h); cycles = 4; break;
      case 0x85: this.add(this.l); cycles = 4; break;
      case 0x86: this.add(this.readByte(this.getHL())); cycles = 7; break;
      case 0x87: this.add(this.a); cycles = 4; break;

      case 0x88: this.add(this.b, this.flags.cy); cycles = 4; break;
      case 0x89: this.add(this.c, this.flags.cy); cycles = 4; break;
      case 0x8a: this.add(this.d, this.flags.cy); cycles = 4; break;
      case 0x8b: this.add(this.e, this.flags.cy); cycles = 4; break;
      case 0x8c: this.add(this.h, this.flags.cy); cycles = 4; break;
      case 0x8d: this.add(this.l, this.flags.cy); cycles = 4; break;
      case 0x8e: this.add(this.readByte(this.getHL()), this.flags.cy); cycles = 7; break;
      case 0x8f: this.add(this.a, this.flags.cy); cycles = 4; break;

      case 0x90: this.sub(this.b); cycles = 4; break;
      case 0x91: this.sub(this.c); cycles = 4; break;
      case 0x92: this.sub(this.d); cycles = 4; break;
      case 0x93: this.sub(this.e); cycles = 4; break;
      case 0x94: this.sub(this.h); cycles = 4; break;
      case 0x95: this.sub(this.l); cycles = 4; break;
      case 0x96: this.sub(this.readByte(this.getHL())); cycles = 7; break;
      case 0x97: this.sub(this.a); cycles = 4; break;

      case 0x98: this.sub(this.b, this.flags.cy); cycles = 4; break;
      case 0x99: this.sub(this.c, this.flags.cy); cycles = 4; break;
      case 0x9a: this.sub(this.d, this.flags.cy); cycles = 4; break;
      case 0x9b: this.sub(this.e, this.flags.cy); cycles = 4; break;
      case 0x9c: this.sub(this.h, this.flags.cy); cycles = 4; break;
      case 0x9d: this.sub(this.l, this.flags.cy); cycles = 4; break;
      case 0x9e: this.sub(this.readByte(this.getHL()), this.flags.cy); cycles = 7; break;
      case 0x9f: this.sub(this.a, this.flags.cy); cycles = 4; break;

      case 0xa0: this.ana(this.b); cycles = 4; break;
      case 0xa1: this.ana(this.c); cycles = 4; break;
      case 0xa2: this.ana(this.d); cycles = 4; break;
      case 0xa3: this.ana(this.e); cycles = 4; break;
      case 0xa4: this.ana(this.h); cycles = 4; break;
      case 0xa5: this.ana(this.l); cycles = 4; break;
      case 0xa6: this.ana(this.readByte(this.getHL())); cycles = 7; break;
      case 0xa7: this.ana(this.a); cycles = 4; break;

      case 0xa8: this.xra(this.b); cycles = 4; break;
      case 0xa9: this.xra(this.c); cycles = 4; break;
      case 0xaa: this.xra(this.d); cycles = 4; break;
      case 0xab: this.xra(this.e); cycles = 4; break;
      case 0xac: this.xra(this.h); cycles = 4; break;
      case 0xad: this.xra(this.l); cycles = 4; break;
      case 0xae: this.xra(this.readByte(this.getHL())); cycles = 7; break;
      case 0xaf: this.xra(this.a); cycles = 4; break;

      case 0xb0: this.ora(this.b); cycles = 4; break;
      case 0xb1: this.ora(this.c); cycles = 4; break;
      case 0xb2: this.ora(this.d); cycles = 4; break;
      case 0xb3: this.ora(this.e); cycles = 4; break;
      case 0xb4: this.ora(this.h); cycles = 4; break;
      case 0xb5: this.ora(this.l); cycles = 4; break;
      case 0xb6: this.ora(this.readByte(this.getHL())); cycles = 7; break;
      case 0xb7: this.ora(this.a); cycles = 4; break;

      case 0xb8: this.cmp(this.b); cycles = 4; break;
      case 0xb9: this.cmp(this.c); cycles = 4; break;
      case 0xba: this.cmp(this.d); cycles = 4; break;
      case 0xbb: this.cmp(this.e); cycles = 4; break;
      case 0xbc: this.cmp(this.h); cycles = 4; break;
      case 0xbd: this.cmp(this.l); cycles = 4; break;
      case 0xbe: this.cmp(this.readByte(this.getHL())); cycles = 7; break;
      case 0xbf: this.cmp(this.a); cycles = 4; break;

      // Returns
      case 0xc0: // RNZ
        if (!this.flags.z) { this.pc = this.pop(); cycles = 11; } else { cycles = 5; }
        break;
      case 0xc8: // RZ
        if (this.flags.z) { this.pc = this.pop(); cycles = 11; } else { cycles = 5; }
        break;
      case 0xd0: // RNC
        if (!this.flags.cy) { this.pc = this.pop(); cycles = 11; } else { cycles = 5; }
        break;
      case 0xd8: // RC
        if (this.flags.cy) { this.pc = this.pop(); cycles = 11; } else { cycles = 5; }
        break;
      case 0xe0: // RPO
        if (!this.flags.p) { this.pc = this.pop(); cycles = 11; } else { cycles = 5; }
        break;
      case 0xe8: // RPE
        if (this.flags.p) { this.pc = this.pop(); cycles = 11; } else { cycles = 5; }
        break;
      case 0xf0: // RP
        if (!this.flags.s) { this.pc = this.pop(); cycles = 11; } else { cycles = 5; }
        break;
      case 0xf8: // RM
        if (this.flags.s) { this.pc = this.pop(); cycles = 11; } else { cycles = 5; }
        break;
      case 0xc9: // RET
        this.pc = this.pop(); cycles = 10;
        break;

      // POP
      case 0xc1: this.setBC(this.pop()); cycles = 10; break;
      case 0xd1: this.setDE(this.pop()); cycles = 10; break;
      case 0xe1: this.setHL(this.pop()); cycles = 10; break;
      case 0xf1: this.setPSW(this.pop()); cycles = 10; break;

      // PUSH
      case 0xc5: this.push(this.getBC()); cycles = 11; break;
      case 0xd5: this.push(this.getDE()); cycles = 11; break;
      case 0xe5: this.push(this.getHL()); cycles = 11; break;
      case 0xf5: this.push(this.getPSW()); cycles = 11; break;

      // Jumps
      case 0xc2: { // JNZ
        const target = this.fetchWord();
        if (!this.flags.z) { this.pc = target; }
        cycles = 10;
        break;
      }
      case 0xca: { // JZ
        const target = this.fetchWord();
        if (this.flags.z) { this.pc = target; }
        cycles = 10;
        break;
      }
      case 0xd2: { // JNC
        const target = this.fetchWord();
        if (!this.flags.cy) { this.pc = target; }
        cycles = 10;
        break;
      }
      case 0xda: { // JC
        const target = this.fetchWord();
        if (this.flags.cy) { this.pc = target; }
        cycles = 10;
        break;
      }
      case 0xe2: { // JPO
        const target = this.fetchWord();
        if (!this.flags.p) { this.pc = target; }
        cycles = 10;
        break;
      }
      case 0xea: { // JPE
        const target = this.fetchWord();
        if (this.flags.p) { this.pc = target; }
        cycles = 10;
        break;
      }
      case 0xf2: { // JP
        const target = this.fetchWord();
        if (!this.flags.s) { this.pc = target; }
        cycles = 10;
        break;
      }
      case 0xfa: { // JM
        const target = this.fetchWord();
        if (this.flags.s) { this.pc = target; }
        cycles = 10;
        break;
      }
      case 0xc3: // JMP
        this.pc = this.fetchWord();
        cycles = 10;
        break;

      // Calls
      case 0xc4: { // CNZ
        const target = this.fetchWord();
        if (!this.flags.z) { this.push(this.pc); this.pc = target; cycles = 17; } else { cycles = 11; }
        break;
      }
      case 0xcc: { // CZ
        const target = this.fetchWord();
        if (this.flags.z) { this.push(this.pc); this.pc = target; cycles = 17; } else { cycles = 11; }
        break;
      }
      case 0xd4: { // CNC
        const target = this.fetchWord();
        if (!this.flags.cy) { this.push(this.pc); this.pc = target; cycles = 17; } else { cycles = 11; }
        break;
      }
      case 0xdc: { // CC
        const target = this.fetchWord();
        if (this.flags.cy) { this.push(this.pc); this.pc = target; cycles = 17; } else { cycles = 11; }
        break;
      }
      case 0xe4: { // CPO
        const target = this.fetchWord();
        if (!this.flags.p) { this.push(this.pc); this.pc = target; cycles = 17; } else { cycles = 11; }
        break;
      }
      case 0xec: { // CPE
        const target = this.fetchWord();
        if (this.flags.p) { this.push(this.pc); this.pc = target; cycles = 17; } else { cycles = 11; }
        break;
      }
      case 0xf4: { // CP
        const target = this.fetchWord();
        if (!this.flags.s) { this.push(this.pc); this.pc = target; cycles = 17; } else { cycles = 11; }
        break;
      }
      case 0xfc: { // CM
        const target = this.fetchWord();
        if (this.flags.s) { this.push(this.pc); this.pc = target; cycles = 17; } else { cycles = 11; }
        break;
      }
      case 0xcd: { // CALL
        const target = this.fetchWord();
        this.push(this.pc);
        this.pc = target;
        cycles = 17;
        break;
      }

      // Immediates
      case 0xc6: this.add(this.fetchByte()); cycles = 7; break; // ADI
      case 0xce: this.add(this.fetchByte(), this.flags.cy); cycles = 7; break; // ACI
      case 0xd6: this.sub(this.fetchByte()); cycles = 7; break; // SUI
      case 0xde: this.sub(this.fetchByte(), this.flags.cy); cycles = 7; break; // SBI
      case 0xe6: this.ana(this.fetchByte()); cycles = 7; break; // ANI
      case 0xee: this.xra(this.fetchByte()); cycles = 7; break; // XRI
      case 0xf6: this.ora(this.fetchByte()); cycles = 7; break; // ORI
      case 0xfe: this.cmp(this.fetchByte()); cycles = 7; break; // CPI

      // Restarts (RST 0 - 7)
      case 0xc7: this.push(this.pc); this.pc = 0x0000; cycles = 11; break;
      case 0xcf: this.push(this.pc); this.pc = 0x0008; cycles = 11; break;
      case 0xd7: this.push(this.pc); this.pc = 0x0010; cycles = 11; break;
      case 0xdf: this.push(this.pc); this.pc = 0x0018; cycles = 11; break;
      case 0xe7: this.push(this.pc); this.pc = 0x0020; cycles = 11; break;
      case 0xef: this.push(this.pc); this.pc = 0x0028; cycles = 11; break;
      case 0xf7: this.push(this.pc); this.pc = 0x0030; cycles = 11; break;
      case 0xff: this.push(this.pc); this.pc = 0x0038; cycles = 11; break;

      // Special
      case 0xeb: { // XCHG (exchange DE and HL)
        const hl = this.getHL();
        this.setHL(this.getDE());
        this.setDE(hl);
        cycles = 4;
        break;
      }
      case 0xe3: { // XTHL (exchange top of stack with HL)
        const val = this.readWord(this.sp);
        this.writeWord(this.sp, this.getHL());
        this.setHL(val);
        cycles = 18;
        break;
      }
      case 0xe9: // PCHL
        this.pc = this.getHL();
        cycles = 5;
        break;
      case 0xf9: // SPHL
        this.sp = this.getHL();
        cycles = 5;
        break;

      // I/O
      case 0xd3: { // OUT port
        const port = this.fetchByte();
        this.ioOut(port, this.a);
        cycles = 10;
        break;
      }
      case 0xdb: { // IN port
        const port = this.fetchByte();
        this.a = this.ioIn(port);
        cycles = 10;
        break;
      }

      // Interrupts
      case 0xf3: this.interruptsEnabled = false; cycles = 4; break; // DI
      case 0xfb: this.interruptsEnabled = true; cycles = 4; break;  // EI

      default:
        // Undefined opcode in strict 8080 treated as NOP or HLT
        cycles = 4;
        break;
    }

    this.cycles += BigInt(cycles);
    return cycles;
  }
}
