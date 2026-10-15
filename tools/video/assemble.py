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

ORDER = [
    "intro", "slides-open",
    "card-app", "app-tour",
    "slides-arch", "card-code", "codebase",
    "card-ci", "slides-ci", "ci-push", "ci-run", "argocd",
    "card-tf", "slides-tf", "terraform",
    "card-k8s", "slides-k8s", "kubernetes",
    "card-obs", "slides-obs", "observability",
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


def render_clip(name, meta):
    src = CLIPS / meta["file"]
    out = BUILD / f"{name}.mp4"
    pieces = segments(meta)
    parts = []
    for i, (a, b, f) in enumerate(pieces):
        parts.append(
            f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{f},fps={FPS},"
            f"scale=1920:1080:flags=lanczos,setsar=1[v{i}]"
        )
    graph = ";".join(parts) + ";" + "".join(f"[v{i}]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0[out]"
    ffmpeg("-i", str(src), "-filter_complex", graph, "-map", "[out]", "-an",
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(out))
    return out


def main():
    BUILD.mkdir(exist_ok=True)
    manifest = json.loads((CLIPS / "manifest.json").read_text())
    names = [n for n in ORDER if n in manifest]
    missing = [n for n in ORDER if n not in manifest]
    if missing:
        print("missing scenes:", ", ".join(missing), file=sys.stderr)
    rendered = []
    for n in names:
        path = render_clip(n, manifest[n])
        rendered.append((path, duration(path)))
        print(f"{n:16} {rendered[-1][1]:6.1f}s")

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
