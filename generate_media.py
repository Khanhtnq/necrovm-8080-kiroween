import os
import sys
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFont

# Base directories derived dynamically - zero hardcoded paths
base_dir = os.path.dirname(os.path.abspath(__file__))
out_thumbnail = os.path.join(base_dir, "assets", "thumbnail_1280x800.png")
out_video = os.path.join(base_dir, "assets", "demo_kiroween_1080p.mp4")
temp_dir = os.path.join(base_dir, "assets", "temp_frames")
os.makedirs(os.path.dirname(out_thumbnail), exist_ok=True)
os.makedirs(temp_dir, exist_ok=True)

# Discover FFmpeg dynamically
ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    # Common Windows fallbacks if not in system PATH
    fallbacks = [
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"),
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"
    ]
    for fb in fallbacks:
        if os.path.isfile(fb):
            ffmpeg = fb
            break

if not ffmpeg:
    print("Warning: FFmpeg binary not found in PATH or standard locations.", file=sys.stderr)

# Discover fonts dynamically
font_path = "consola.ttf"
font_path_bold = "consolab.ttf"
win_fonts = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "Fonts")
if os.path.isdir(win_fonts):
    fp = os.path.join(win_fonts, "consola.ttf")
    fpb = os.path.join(win_fonts, "consolab.ttf")
    if os.path.isfile(fp):
        font_path = fp
    if os.path.isfile(fpb):
        font_path_bold = fpb

# ==========================================
# 1. GENERATE THUMBNAIL (1280x800)
# ==========================================
img = Image.new("RGB", (1280, 800), color="#070d07")
draw = ImageDraw.Draw(img)

# Phosphor scanlines
for y in range(0, 800, 4):
    draw.line([(0, y), (1280, y)], fill="#040804", width=1)

f_title = ImageFont.truetype(font_path_bold, 68)
f_sub = ImageFont.truetype(font_path, 28)
f_gold = ImageFont.truetype(font_path_bold, 30)
f_tracks = ImageFont.truetype(font_path, 24)
f_body = ImageFont.truetype(font_path, 22)
f_term = ImageFont.truetype(font_path_bold, 26)

# Title & Glow
draw.text((640, 150), "NECROVM 8080", font=f_title, fill="#33ff33", anchor="mm")
draw.text((640, 230), "Resurrecting 1974 CP/M Silicon Stitched to MCP Agent Debugging", font=f_sub, fill="#88ff88", anchor="mm")

# Divider
draw.line([(180, 280), (1100, 280)], fill="#33ff33", width=2)

# Tracks
draw.text((640, 330), "DEVPOST KIROWEEN 2026  |  $100,000 USD HACKATHON", font=f_gold, fill="#ffb000", anchor="mm")
draw.text((640, 400), "[Best Resurrection]  +  [Best Frankenstein]  +  [Best Costume]", font=f_tracks, fill="#ffffff", anchor="mm")

# Tech specs
draw.text((640, 480), "Cycle-Accurate 8080 Core  *  CP/M 2.2 BDOS Syscalls  *  Zero Dependencies", font=f_body, fill="#33ff33", anchor="mm")
draw.text((640, 530), "Dual Phosphor CRT Terminal (P31 Green / P20 Amber)  *  JSON-RPC 2.0 MCP Tools", font=f_body, fill="#33ff33", anchor="mm")

# Terminal prompt box
draw.rectangle([(220, 610), (1060, 690)], outline="#33ff33", width=2, fill="#020502")
draw.text((640, 650), "A:\\> MCP_DEBUGGER.COM --STATUS ONLINE --PORT 8080", font=f_term, fill="#33ff33", anchor="mm")

img.save(out_thumbnail)
print("Thumbnail saved:", out_thumbnail)

# ==========================================
# 2. GENERATE VIDEO FRAMES (1920x1080)
# ==========================================
chapters = [
    {
        "title": "CHAPTER 1: THE RESURRECTION",
        "subtitle": "1974 Intel 8080 Silicon Restored in Pure ES Modules",
        "bullets": [
            "Cycle-accurate instruction decoder matching vintage T-state timing",
            "Intel 8080 Program Status Word: Sign, Zero, AuxCarry, Parity, Carry",
            "Full memory address space (64KB RAM) and stack mechanics (PUSH, POP, CALL, RET)",
            "Track Target: Best Resurrection ($5,000 USD)"
        ]
    },
    {
        "title": "CHAPTER 2: CP/M 2.2 BDOS INTEGRATION",
        "subtitle": "Digital Research Operating System Syscalls & Virtual Storage",
        "bullets": [
            "Vector 0x0005 trap handling C_WRITE, C_WRITESTR, C_READ, and C_READSTR",
            "CP/M 2.2 File Control Block (FCB) parser: F_OPEN (fn 15) and F_READ (fn 20)",
            "128-byte logical record DMA sector streaming into Transient Program Area (0x0100)",
            "18/18 Automated Node.js Tests Passing with 100% flag veracity"
        ]
    },
    {
        "title": "CHAPTER 3: THE FRANKENSTEIN STITCH",
        "subtitle": "Stitching 52-Year-Old Silicon to 2026 Model Context Protocol (MCP)",
        "bullets": [
            "Anthropic MCP JSON-RPC 2.0 server interface via Stdio & WebSocket",
            "necro_inspect_registers: Live register and PSW flag introspection",
            "necro_step_cycles: Precision cycle-stepping and breakpoint triggers",
            "necro_assemble_and_load: Dynamic two-pass macro assembly injection",
            "Track Target: Best Frankenstein ($5,000 USD)"
        ]
    },
    {
        "title": "CHAPTER 4: HAUNTING CRT COSTUME",
        "subtitle": "P31 Green & P20 Amber Phosphor Scanline Terminal Experience",
        "bullets": [
            "Authentic CRT bloom shaders, raytraced scanlines, and barrel glass curvature",
            "Live register dashboard, interactive hex inspector, and CP/M console screen",
            "Built with zero runtime npm dependencies - runs seamlessly everywhere",
            "Track Target: Best Costume Contest ($5,000 USD) + Overall Grand Prize ($30,000 USD)"
        ]
    }
]

f_v_title = ImageFont.truetype(font_path_bold, 54)
f_v_sub = ImageFont.truetype(font_path, 32)
f_v_gold = ImageFont.truetype(font_path_bold, 36)
f_v_bullet = ImageFont.truetype(font_path, 28)
f_v_status = ImageFont.truetype(font_path_bold, 26)

frame_files = []
print("Rendering video keyframes...")
for ch_idx, ch in enumerate(chapters):
    frame_img = Image.new("RGB", (1920, 1080), color="#050a05")
    d = ImageDraw.Draw(frame_img)
    
    # Scanline grid
    for y in range(0, 1080, 4):
        d.line([(0, y), (1920, y)], fill="#030603", width=1)
    
    # Outer CRT bezel frame
    d.rectangle([(20, 20), (1900, 1060)], outline="#33ff33", width=2)
    
    # Header
    d.text((960, 90), "NECROVM 8080  *  DEVPOST KIROWEEN 2026", font=f_v_gold, fill="#ffb000", anchor="mm")
    d.line([(100, 140), (1820, 140)], fill="#33ff33", width=2)
    
    # Chapter Title
    d.text((960, 200), ch["title"], font=f_v_title, fill="#33ff33", anchor="mm")
    d.text((960, 260), ch["subtitle"], font=f_v_sub, fill="#88ff88", anchor="mm")
    
    # Bullets
    start_y = 360
    for b_idx, bullet in enumerate(ch["bullets"]):
        y_pos = start_y + b_idx * 75
        d.text((220, y_pos), f">>  {bullet}", font=f_v_bullet, fill="#ffffff" if "Track Target" in bullet else "#aaffaa")
    
    # Hardware Telemetry Bar
    d.rectangle([(100, 880), (1820, 960)], outline="#33ff33", fill="#020402", width=1)
    d.text((960, 920), f"[CLOCK: 2.000 MHz]  [TPA: 0x0100 - 0xDC00]  [MCP SERVER: ACTIVE]  [CHAPTER {ch_idx+1}/4]", font=f_v_status, fill="#33ff33", anchor="mm")
    
    slide_path = os.path.join(temp_dir, f"chapter_{ch_idx}.png")
    frame_img.save(slide_path)
    frame_files.append(slide_path)

if ffmpeg:
    print("Encoding 40s 1080p 30fps MP4 video with FFmpeg...")
    concat_script = os.path.join(temp_dir, "concat.txt")
    with open(concat_script, "w") as f:
        for sf in frame_files:
            f.write(f"file '{os.path.basename(sf)}'\n")
            f.write("duration 10.0\n")
        f.write(f"file '{os.path.basename(frame_files[-1])}'\n")

    audio_filter = "sine=f=440:r=44100:d=40,volume=0.02"

    cmd_encode = [
        ffmpeg, "-f", "concat", "-safe", "0", "-i", concat_script,
        "-f", "lavfi", "-i", audio_filter,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "128k", "-t", "40", "-y", out_video
    ]

    subprocess.run(cmd_encode, check=True, cwd=temp_dir)
    print("Demo Video generated successfully:", out_video)

# Clean up temp frames
shutil.rmtree(temp_dir, ignore_errors=True)
