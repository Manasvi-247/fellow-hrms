"""Turns the recorded clips into the final demo video: trims, speeds up waits, then joins scenes with transitions."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLIPS = ROOT / "clips"
BUILD = ROOT / "build"
OUT = ROOT.parent.parent / "demo" / "fellow-demo.mp4"
FADE = 0.45
FPS = 30

SUBS = json.loads((ROOT / "subtitles.json").read_text())
SUB_DIR = BUILD / "subs"
CONTENT_W, CONTENT_H, BAND = 1728, 972, 108
FRAME = "0x14121A"

ORDER = [
    "intro", "slides-open", "readme",
    "card-app", "app-tour",
    "slides-arch", "card-code", "codebase", "api-docs",
    "card-ci", "slides-ci", "ci-push", "ci-run", "argocd",
    "card-tf", "slides-tf", "terraform",
    "card-k8s", "slides-k8s", "kubernetes",
    "card-obs", "slides-obs", "metrics", "observability",
    "card-ts", "slides-ts", "troubleshooting",
    "slides-end", "outro",
]


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def segments(meta):
    """Splits a clip into (from, to, speed) pieces after the start mark, dropping cut ranges."""
    points = [(s["from"], s["to"], s["factor"]) for s in meta.get("speed", [])]
    points += [(c["from"], c["to"], 0) for c in meta.get("cut", [])]
    points.sort()
    pieces, t = [], meta.get("start", 0)
    end = meta["end"]
    for a, b, f in points:
        if a > t:
            pieces.append((t, a, 1))
        if f:
            pieces.append((max(a, t), b, f))
        t = max(t, b)
    if end - 0.3 > t:
        pieces.append((t, end - 0.3, 1))
    return [p for p in pieces if p[1] - p[0] > 0.05]


def to_output_time(t, pieces):
    """Maps a time in the raw recording to the trimmed, sped-up clip."""
    out = 0.0
    for a, b, f in pieces:
        if t <= a:
            return out
        if t <= b:
            return out + (t - a) / f
        out += (b - a) / f
    return out


def sub_windows(name, length, meta, pieces):
    """Places subtitle lines at the recorded cues, or spreads them evenly when a scene has none."""
    lines = SUBS.get(name, [])
    if not lines:
        return []
    end = max(0.5, length - 0.35)
    cues = meta.get("cues", [])
    if len(cues) == len(lines):
        starts = [max(0.25, to_output_time(c, pieces)) for c in cues]
    else:
        step = (end - 0.25) / len(lines)
        starts = [0.25 + i * step for i in range(len(lines))]
    bounds = starts[1:] + [end]
    return [(i, starts[i], max(starts[i] + 0.5, bounds[i])) for i in range(len(lines))]


def render_clip(name, meta):
    src = CLIPS / meta["file"]
    out = BUILD / f"{name}.mp4"
    pieces = segments(meta)
    length = sum((b - a) / f for a, b, f in pieces)
    windows = sub_windows(name, length, meta, pieces)
    parts = []
    for i, (a, b, f) in enumerate(pieces):
        parts.append(
            f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{f},fps={FPS},"
            f"scale={CONTENT_W}:{CONTENT_H}:flags=lanczos,setsar=1[v{i}]"
        )
    graph = ";".join(parts) + ";" + "".join(f"[v{i}]" for i in range(len(pieces)))
    graph += f"concat=n={len(pieces)}:v=1:a=0,pad=1920:1080:{(1920 - CONTENT_W) // 2}:0:color={FRAME}[base]"
    inputs = ["-i", str(src)]
    prev = "[base]"
    for k, (i, t0, t1) in enumerate(windows):
        inputs += ["-loop", "1", "-t", f"{length:.3f}", "-i", str(SUB_DIR / f"{name}-{i}.png")]
        label = f"[s{k}]"
        graph += f";{prev}[{k + 1}:v]overlay=0:{CONTENT_H}:enable='between(t,{t0:.3f},{t1:.3f})'{label}"
        prev = label
    graph += f";{prev}format=yuv420p[out]"
    ffmpeg(*inputs, "-filter_complex", graph, "-map", "[out]", "-an", "-t", f"{length:.3f}",
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(out))
    return out, windows


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    BUILD.mkdir(exist_ok=True)
    manifest = json.loads((CLIPS / "manifest.json").read_text())
    names = [n for n in ORDER if n in manifest]
    missing = [n for n in ORDER if n not in manifest]
    if missing:
        print("missing scenes:", ", ".join(missing), file=sys.stderr)
    rendered, cues, clock = [], [], 0.0
    for n in names:
        path, windows = render_clip(n, manifest[n])
        length = duration(path)
        for i, t0, t1 in windows:
            cues.append((clock + t0, clock + t1, SUBS[n][i]))
        rendered.append((path, length))
        clock += length - FADE
        print(f"{n:16} {length:6.1f}s")
    srt = OUT.with_suffix(".srt")
    srt.write_text("".join(f"{k + 1}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n\n" for k, (a, b, text) in enumerate(cues)))

    inputs, chain, offset = [], "", 0.0
    for i, (path, _) in enumerate(rendered):
        inputs += ["-i", str(path)]
    prev = "[0:v]"
    for i in range(1, len(rendered)):
        offset += rendered[i - 1][1] - FADE
        label = f"[x{i}]"
        chain += f"{prev}[{i}:v]xfade=transition=smoothleft:duration={FADE}:offset={offset:.3f}{label};"
        prev = label
    chain += f"{prev}format=yuv420p[final]"
    OUT.parent.mkdir(exist_ok=True)
    ffmpeg(*inputs, "-filter_complex", chain, "-map", "[final]", "-an",
           "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-movflags", "+faststart", str(OUT))
    print(f"wrote {OUT} ({duration(OUT):.1f}s, {OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
