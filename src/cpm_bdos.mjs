/**
 * NecroVM 8080 - Digital Research CP/M 2.2 BDOS Syscall Subsystem
 * Emulates the legendary CP/M 2.2 entry point at 0x0005.
 * Handles Console I/O, File System emulation, and DMA record buffers.
 */

export class CpmBdos {
  constructor(cpu) {
    this.cpu = cpu;
    this.outputBuffer = [];
    this.inputBuffer = [];
    this.currentDisk = 0; // 0 = A:, 1 = B:
    this.dmaAddress = 0x0080; // Default CP/M DMA buffer

    // Virtual In-Memory CP/M Filesystem
    // Key: filename (e.g. "README  TXT"), Value: Uint8Array
    this.virtualFiles = new Map();

    // Hook CPU BDOS trap
    this.cpu.bdosTrap = this.handleTrap.bind(this);

    // Initialize CP/M Page Zero Vectors
    this.initPageZero();
  }

  initPageZero() {
    // 0x0000: Warm Boot JMP 0xFA00 (HLT in NecroVM)
    this.cpu.writeByte(0x0000, 0xc3); // JMP
    this.cpu.writeWord(0x0001, 0xfa00);

    // 0x0005: BDOS Entry JMP 0xEC00
    this.cpu.writeByte(0x0005, 0xc3); // JMP
    this.cpu.writeWord(0x0006, 0xec00);

    // High memory traps
    // 0xEC00: RET to simulate returning from BDOS call
    this.cpu.writeByte(0xec00, 0xc9); // RET

    // 0xFA00: HLT to terminate program upon Warm Boot
    this.cpu.writeByte(0xfa00, 0x76); // HLT
  }

  // Preload a virtual file into the CP/M filesystem
  createVirtualFile(filename, content) {
    const formatted = this.format83Name(filename);
    const bytes = (typeof content === 'string') 
      ? new TextEncoder().encode(content) 
      : content;
    this.virtualFiles.set(formatted, bytes);
  }

  format83Name(raw) {
    const parts = raw.toUpperCase().split('.');
    const name = (parts[0] || '').padEnd(8, ' ').slice(0, 8);
    const ext = (parts[1] || '').padEnd(3, ' ').slice(0, 3);
    return name + ext;
  }

  handleTrap(cpu) {
    // CP/M BDOS passes function number in register C (or E for some utilities)
    // Parameter is usually in DE or E. Return value in A (and L).
    const fn = cpu.c;

    switch (fn) {
      // Function 0: System Reset (P_TERMCPM)
      case 0:
        cpu.halted = true;
        break;

      // Function 1: Console Input (C_READ)
      case 1: {
        const charCode = this.inputBuffer.length > 0 ? this.inputBuffer.shift() : 0x0d;
        cpu.a = charCode;
        cpu.l = charCode;
        break;
      }

      // Function 2: Console Output (C_WRITE)
      case 2: {
        const char = String.fromCharCode(cpu.e);
        this.outputBuffer.push(char);
        break;
      }

      // Function 6: Direct Console I/O (C_RAWIO)
      case 6: {
        if (cpu.e === 0xff) {
          // Input requested
          if (this.inputBuffer.length > 0) {
            const ch = this.inputBuffer.shift();
            cpu.a = ch;
            cpu.l = ch;
          } else {
            cpu.a = 0x00;
            cpu.l = 0x00;
          }
        } else {
          // Output requested
          this.outputBuffer.push(String.fromCharCode(cpu.e));
        }
        break;
      }

      // Function 9: Console Print String (C_WRITESTR)
      // DE points to string terminated by '$' (0x24)
      case 9: {
        let addr = cpu.getDE();
        let charCode = cpu.readByte(addr);
        let out = '';
        while (charCode !== 0x24 && addr < 0xffff) { // '$'
          out += String.fromCharCode(charCode);
          addr++;
          charCode = cpu.readByte(addr);
        }
        this.outputBuffer.push(out);
        break;
      }

      // Function 10: Read Console String (C_READSTR)
      // DE points to input buffer: [max_len, actual_len, bytes...]
      case 10: {
        const bufAddr = cpu.getDE();
        const maxLen = cpu.readByte(bufAddr);
        let str = '';
        while (this.inputBuffer.length > 0 && str.length < maxLen) {
          const ch = this.inputBuffer.shift();
          if (ch === 0x0d || ch === 0x0a) break;
          str += String.fromCharCode(ch);
        }
        cpu.writeByte(bufAddr + 1, str.length);
        for (let i = 0; i < str.length; i++) {
          cpu.writeByte(bufAddr + 2 + i, str.charCodeAt(i));
        }
        break;
      }

      // Function 12: Return Version Number (S_BDOSVER)
      // CP/M 2.2 returns 0x0022
      case 12:
        cpu.a = 0x22;
        cpu.b = 0x00;
        cpu.h = 0x00;
        cpu.l = 0x22;
        break;

      // Function 14: Select Disk (DRV_SET)
      case 14:
        this.currentDisk = cpu.e;
        break;

      // Function 15: Open File (F_OPEN)
      // DE points to FCB. Bytes 1..8: Name, 9..11: Ext
      case 15: {
        const fcbAddr = cpu.getDE();
        let nameExt = '';
        for (let i = 1; i <= 11; i++) {
          nameExt += String.fromCharCode(cpu.readByte(fcbAddr + i) & 0x7f);
        }
        if (this.virtualFiles.has(nameExt)) {
          // File found! Return directory code (0..3)
          cpu.a = 0x00;
          cpu.l = 0x00;
          // Set extent = 0, current record = 0
          cpu.writeByte(fcbAddr + 12, 0); // EX
          cpu.writeByte(fcbAddr + 32, 0); // CR
        } else {
          // Not found: return 0xFF
          cpu.a = 0xff;
          cpu.l = 0xff;
        }
        break;
      }

      // Function 20: Read Next Record (F_READ)
      // Reads 128 bytes into current DMA address
      case 20: {
        const fcbAddr = cpu.getDE();
        let nameExt = '';
        for (let i = 1; i <= 11; i++) {
          nameExt += String.fromCharCode(cpu.readByte(fcbAddr + i) & 0x7f);
        }

        const fileData = this.virtualFiles.get(nameExt);
        if (!fileData) {
          cpu.a = 0x01; // EOF
          cpu.l = 0x01;
          break;
        }

        const currentRec = cpu.readByte(fcbAddr + 32);
        const offset = currentRec * 128;

        if (offset >= fileData.length) {
          cpu.a = 0x01; // End of file
          cpu.l = 0x01;
        } else {
          for (let i = 0; i < 128; i++) {
            const byte = (offset + i < fileData.length) ? fileData[offset + i] : 0x1a; // 0x1A = CP/M EOF
            cpu.writeByte(this.dmaAddress + i, byte);
          }
          // Increment record counter
          cpu.writeByte(fcbAddr + 32, currentRec + 1);
          cpu.a = 0x00; // Success
          cpu.l = 0x00;
        }
        break;
      }

      // Function 26: Set DMA Address (F_DMAOFF)
      case 26:
        this.dmaAddress = cpu.getDE();
        break;

      // Function 25: Get Current Disk (DRV_GET)
      case 25:
        cpu.a = this.currentDisk;
        cpu.l = this.currentDisk;
        break;

      default:
        // Unsupported BDOS call
        cpu.a = 0x00;
        cpu.l = 0x00;
        break;
    }

    // Handled trap: return from 0x0005 call
    const retAddr = cpu.pop();
    cpu.pc = retAddr;
    return true;
  }

  // Flush and return all console output collected
  getConsoleOutput() {
    const text = this.outputBuffer.join('');
    this.outputBuffer = [];
    return text;
  }

  // Push user characters into input stream
  feedInput(text) {
    for (let i = 0; i < text.length; i++) {
      this.inputBuffer.push(text.charCodeAt(i));
    }
  }
}
