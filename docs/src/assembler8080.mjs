/**
 * NecroVM 8080 - Two-Pass Intel 8080 Macro Assembler
 * Parses Intel 8080 mnemonics, labels, expressions, and directives (ORG, DB, DW, DS, EQU).
 * Outputs assembled machine code byte array and symbol table.
 */

export class Assembler8080 {
  constructor() {
    this.symbols = new Map();
    this.source = '';
  }

  // Parse constant number: 100, 0x100, 100H, 100h, 0100h, '$'
  parseNumber(str, currentPC) {
    if (!str) return 0;
    str = str.trim();
    if (str === '$') return currentPC;

    // Hex suffix 'H' or 'h'
    if (/^[0-9A-Fa-f]+[Hh]$/.test(str)) {
      return parseInt(str.slice(0, -1), 16);
    }
    // Hex prefix '0x' or '$'
    if (str.startsWith('0x') || str.startsWith('0X')) {
      return parseInt(str.slice(2), 16);
    }
    if (str.startsWith('$') && str.length > 1) {
      return parseInt(str.slice(1), 16);
    }
    // Binary suffix 'B' or 'b'
    if (/^[01]+[Bb]$/.test(str)) {
      return parseInt(str.slice(0, -1), 2);
    }
    // Octal suffix 'O' or 'Q'
    if (/^[0-7]+[OoQq]$/.test(str)) {
      return parseInt(str.slice(0, -1), 8);
    }
    // Character literal 'A'
    if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
      if (str.length === 3) return str.charCodeAt(1);
    }

    const n = parseInt(str, 10);
    return isNaN(n) ? null : n;
  }

  evaluateOperand(operand, currentPC) {
    operand = operand.trim();
    const num = this.parseNumber(operand, currentPC);
    if (num !== null) return num;

    if (this.symbols.has(operand.toUpperCase())) {
      return this.symbols.get(operand.toUpperCase());
    }
    return null;
  }

  assemble(sourceText) {
    this.source = sourceText;
    this.symbols.clear();

    const lines = sourceText.split(/\r?\n/);

    // ==========================================
    // PASS 1: Symbol resolution & address tracking
    // ==========================================
    let currentPC = 0x0100; // Default CP/M TPA start

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      let line = lines[lineIndex].trim();
      // Strip comments (; ...)
      const commentIdx = line.indexOf(';');
      if (commentIdx !== -1) {
        line = line.substring(0, commentIdx).trim();
      }
      if (!line) continue;

      // Extract label if present (e.g. "START:" or "START EQU 100")
      let label = null;
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        label = line.substring(0, colonIdx).trim().toUpperCase();
        line = line.substring(colonIdx + 1).trim();
      }

      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) {
        if (label) this.symbols.set(label, currentPC);
        continue;
      }

      const mnemonic = tokens[0].toUpperCase();
      const rest = line.substring(tokens[0].length).trim();

      // Check EQU directive
      if (tokens[1] && tokens[1].toUpperCase() === 'EQU') {
        const symName = tokens[0].toUpperCase();
        const eqValStr = line.substring(line.toUpperCase().indexOf('EQU') + 3).trim();
        const val = this.parseNumber(eqValStr, currentPC);
        this.symbols.set(symName, val !== null ? val : 0);
        continue;
      }

      if (label) {
        this.symbols.set(label, currentPC);
      }

      if (mnemonic === 'ORG') {
        const orgVal = this.parseNumber(rest, currentPC);
        if (orgVal !== null) currentPC = orgVal & 0xffff;
        continue;
      }

      if (mnemonic === 'DS') {
        const count = this.parseNumber(rest, currentPC) || 1;
        currentPC = (currentPC + count) & 0xffff;
        continue;
      }

      if (mnemonic === 'DB') {
        const parts = this.splitArgs(rest);
        for (const p of parts) {
          if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
            currentPC += Math.max(0, p.length - 2);
          } else {
            currentPC += 1;
          }
        }
        continue;
      }

      if (mnemonic === 'DW') {
        const parts = this.splitArgs(rest);
        currentPC += parts.length * 2;
        continue;
      }

      // Calculate instruction size in bytes (1, 2, or 3)
      const size = this.getInstructionSize(mnemonic, rest);
      currentPC = (currentPC + size) & 0xffff;
    }

    // ==========================================
    // PASS 2: Machine code emission
    // ==========================================
    currentPC = 0x0100;
    const output = []; // Array of { address, bytes }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      let line = lines[lineIndex].trim();
      const commentIdx = line.indexOf(';');
      if (commentIdx !== -1) {
        line = line.substring(0, commentIdx).trim();
      }
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        line = line.substring(colonIdx + 1).trim();
      }

      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;

      const mnemonic = tokens[0].toUpperCase();
      const rest = line.substring(tokens[0].length).trim();

      if (tokens[1] && tokens[1].toUpperCase() === 'EQU') continue;

      if (mnemonic === 'ORG') {
        const orgVal = this.parseNumber(rest, currentPC);
        if (orgVal !== null) currentPC = orgVal & 0xffff;
        continue;
      }

      if (mnemonic === 'DS') {
        const count = this.parseNumber(rest, currentPC) || 1;
        for (let i = 0; i < count; i++) {
          output.push({ address: currentPC + i, byte: 0x00 });
        }
        currentPC = (currentPC + count) & 0xffff;
        continue;
      }

      if (mnemonic === 'DB') {
        const parts = this.splitArgs(rest);
        for (const p of parts) {
          if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
            const raw = p.slice(1, -1);
            for (let i = 0; i < raw.length; i++) {
              output.push({ address: currentPC++, byte: raw.charCodeAt(i) });
            }
          } else {
            const val = this.evaluateOperand(p, currentPC) || 0;
            output.push({ address: currentPC++, byte: val & 0xff });
          }
        }
        continue;
      }

      if (mnemonic === 'DW') {
        const parts = this.splitArgs(rest);
        for (const p of parts) {
          const val = this.evaluateOperand(p, currentPC) || 0;
          output.push({ address: currentPC++, byte: val & 0xff });
          output.push({ address: currentPC++, byte: (val >> 8) & 0xff });
        }
        continue;
      }

      // Encode instruction
      const encoded = this.encodeInstruction(mnemonic, rest, currentPC);
      for (const b of encoded) {
        output.push({ address: currentPC++, byte: b });
      }
    }

    return {
      bytes: output,
      symbols: Object.fromEntries(this.symbols),
      entryPoint: 0x0100
    };
  }

  splitArgs(str) {
    const parts = [];
    let cur = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if ((c === '"' || c === "'") && !inQuote) {
        inQuote = true;
        quoteChar = c;
        cur += c;
      } else if (c === quoteChar && inQuote) {
        inQuote = false;
        cur += c;
      } else if (c === ',' && !inQuote) {
        parts.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  getInstructionSize(mnemonic, rest) {
    // 3-byte instructions: LXI, LDA, STA, LHLD, SHLD, JMP, Jcc, CALL, Ccc
    if (/^(LXI|LDA|STA|LHLD|SHLD|JMP|JNZ|JZ|JNC|JC|JPO|JPE|JP|JM|CALL|CNZ|CZ|CNC|CC|CPO|CPE|CP|CM)$/.test(mnemonic)) {
      return 3;
    }
    // 2-byte instructions: MVI, ADI, ACI, SUI, SBI, ANI, XRI, ORI, CPI, IN, OUT
    if (/^(MVI|ADI|ACI|SUI|SBI|ANI|XRI|ORI|CPI|IN|OUT)$/.test(mnemonic)) {
      return 2;
    }
    // 1-byte instructions: MOV, ADD, SUB, ANA, ORA, XRA, CMP, INR, DCR, INX, DCX, DAD, PUSH, POP, RET, Rcc, RST, NOP, HLT, etc.
    return 1;
  }

  encodeInstruction(mnemonic, rest, currentPC) {
    const args = this.splitArgs(rest);

    // Helpers
    const regCodes = { B: 0, C: 1, D: 2, E: 3, H: 4, L: 5, M: 6, A: 7 };
    const rpCodes = { B: 0, BC: 0, D: 1, DE: 1, H: 2, HL: 2, SP: 3, PSW: 3 };

    switch (mnemonic) {
      case 'NOP': return [0x00];
      case 'HLT': return [0x76];
      case 'EI':  return [0xfb];
      case 'DI':  return [0xf3];
      case 'RET': return [0xc9];
      case 'RNZ': return [0xc0];
      case 'RZ':  return [0xc8];
      case 'RNC': return [0xd0];
      case 'RC':  return [0xd8];
      case 'RPO': return [0xe0];
      case 'RPE': return [0xe8];
      case 'RP':  return [0xf0];
      case 'RM':  return [0xf8];

      case 'RLC': return [0x07];
      case 'RRC': return [0x0f];
      case 'RAL': return [0x17];
      case 'RAR': return [0x1f];
      case 'CMA': return [0x2f];
      case 'STC': return [0x37];
      case 'CMC': return [0x3f];
      case 'DAA': return [0x27];
      case 'XCHG': return [0xeb];
      case 'XTHL': return [0xe3];
      case 'SPHL': return [0xf9];
      case 'PCHL': return [0xe9];

      case 'MOV': {
        const dst = regCodes[args[0].toUpperCase()];
        const src = regCodes[args[1].toUpperCase()];
        return [0x40 | (dst << 3) | src];
      }

      case 'MVI': {
        const dst = regCodes[args[0].toUpperCase()];
        const val = this.evaluateOperand(args[1], currentPC) || 0;
        return [0x06 | (dst << 3), val & 0xff];
      }

      case 'LXI': {
        const rp = rpCodes[args[0].toUpperCase()];
        const val = this.evaluateOperand(args[1], currentPC) || 0;
        return [0x01 | (rp << 4), val & 0xff, (val >> 8) & 0xff];
      }

      case 'LDA': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0x3a, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'STA': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0x32, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'LHLD': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0x2a, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'SHLD': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0x22, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'LDAX': {
        const rp = rpCodes[args[0].toUpperCase()];
        return [0x0a | (rp << 4)];
      }
      case 'STAX': {
        const rp = rpCodes[args[0].toUpperCase()];
        return [0x02 | (rp << 4)];
      }

      case 'INX': {
        const rp = rpCodes[args[0].toUpperCase()];
        return [0x03 | (rp << 4)];
      }
      case 'DCX': {
        const rp = rpCodes[args[0].toUpperCase()];
        return [0x0b | (rp << 4)];
      }
      case 'DAD': {
        const rp = rpCodes[args[0].toUpperCase()];
        return [0x09 | (rp << 4)];
      }

      case 'INR': {
        const r = regCodes[args[0].toUpperCase()];
        return [0x04 | (r << 3)];
      }
      case 'DCR': {
        const r = regCodes[args[0].toUpperCase()];
        return [0x05 | (r << 3)];
      }

      case 'ADD': return [0x80 | regCodes[args[0].toUpperCase()]];
      case 'ADC': return [0x88 | regCodes[args[0].toUpperCase()]];
      case 'SUB': return [0x90 | regCodes[args[0].toUpperCase()]];
      case 'SBB': return [0x98 | regCodes[args[0].toUpperCase()]];
      case 'ANA': return [0xa0 | regCodes[args[0].toUpperCase()]];
      case 'XRA': return [0xa8 | regCodes[args[0].toUpperCase()]];
      case 'ORA': return [0xb0 | regCodes[args[0].toUpperCase()]];
      case 'CMP': return [0xb8 | regCodes[args[0].toUpperCase()]];

      case 'ADI': {
        const val = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xc6, val & 0xff];
      }
      case 'ACI': {
        const val = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xce, val & 0xff];
      }
      case 'SUI': {
        const val = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xd6, val & 0xff];
      }
      case 'SBI': {
        const val = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xde, val & 0xff];
      }
      case 'ANI': {
        const val = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xe6, val & 0xff];
      }
      case 'XRI': {
        const val = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xee, val & 0xff];
      }
      case 'ORI': {
        const val = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xf6, val & 0xff];
      }
      case 'CPI': {
        const val = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xfe, val & 0xff];
      }

      case 'JMP': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xc3, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'JNZ': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xc2, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'JZ': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xca, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'JNC': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xd2, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'JC': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xda, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'JPO': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xe2, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'JPE': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xea, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'JP': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xf2, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'JM': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xfa, addr & 0xff, (addr >> 8) & 0xff];
      }

      case 'CALL': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xcd, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'CNZ': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xc4, addr & 0xff, (addr >> 8) & 0xff];
      }
      case 'CZ': {
        const addr = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xcc, addr & 0xff, (addr >> 8) & 0xff];
      }

      case 'PUSH': {
        const rp = rpCodes[args[0].toUpperCase()];
        return [0xc5 | (rp << 4)];
      }
      case 'POP': {
        const rp = rpCodes[args[0].toUpperCase()];
        return [0xc1 | (rp << 4)];
      }

      case 'RST': {
        const num = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xc7 | ((num & 7) << 3)];
      }

      case 'IN': {
        const port = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xdb, port & 0xff];
      }
      case 'OUT': {
        const port = this.evaluateOperand(args[0], currentPC) || 0;
        return [0xd3, port & 0xff];
      }

      default:
        return [0x00]; // NOP on unknown
    }
  }
}
