"""Cuts a 20 second teaser from the raw scene recordings: full frame, punchy labels, no audio."""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLIPS = ROOT / "clips"
BUILD = ROOT / "build" / "teaser"
OUT = ROOT.parent.parent / "demo" / "fellow-teaser.mp4"
POSTER = OUT.with_suffix(".jpg")
FADE = 0.25
FPS = 30

# (clip, raw start, raw end, speed, label)
SHOTS = [
    ("teaser-hook", None, 2.7, 1, None),
    ("app-tour", 3.0, 4.6, 1, "LIVE APP"),
    ("app-tour", 37.2, 40.4, 1, "APPROVE IN ONE CLICK"),
    ("ci-run", 88.0, 91.0, 1, "CI: 5/5 GREEN, 0 CVEs"),
    ("argocd", 6.0, 8.6, 1, "GITOPS: SYNCED"),
    ("kubernetes", 128.0, 145.2, 6, "AUTOSCALING 2 → 6"),
    ("observability", 13.5, 16.5, 1, "LIVE METRICS"),
    ("teaser-outro", None, 2.9, 1, None),
]


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def render_labels():
    labels = sorted({s[4] for s in SHOTS if s[4]})
    script = """
import { chromium } from 'playwright-core';
const labels = %s;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 200 } });
for (const [i, t] of labels.entries()) {
  await p.setContent(`<body style="margin:0;background:transparent"><div id="l" style="display:inline-block;margin:20px;padding:16px 30px;
    background:#1B1A24;color:#FFBDC5;border:4px solid #FFBDC5;border-radius:20px;box-shadow:10px 10px 0 #C69FD5;
    font:800 46px 'Roboto Mono',monospace;letter-spacing:.04em;transform:rotate(-2deg)">${t}</div></body>`);
  await p.locator('#l').screenshot({ path: '%s/label-' + i + '.png', omitBackground: true });
}
await b.close();
""" % (json.dumps(labels), BUILD)
    (BUILD / "labels.mjs").write_text(script)
    subprocess.run(["node", str(BUILD / "labels.mjs")], check=True, cwd=ROOT)
    return {t: BUILD / f"label-{i}.png" for i, t in enumerate(labels)}


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((CLIPS / "manifest.json").read_text())
    labels = render_labels()
    parts = []
    for k, (clip, a, b, speed, label) in enumerate(SHOTS):
        meta = manifest[clip]
        if a is None:
            a, b = meta["start"] + 0.2, meta["start"] + 0.2 + b
        out = BUILD / f"shot-{k}.mp4"
        length = (b - a) / speed
        vf = (f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{speed},fps={FPS},"
              f"scale=1920:1080:flags=lanczos,setsar=1[v]")
        inputs = ["-i", str(CLIPS / meta["file"])]
        if label:
            inputs += ["-loop", "1", "-t", f"{length:.3f}", "-i", str(labels[label])]
            vf += ";[v][1:v]overlay=48:40:enable='gte(t,0.15)'[o]"
            last = "[o]"
        else:
            last = "[v]"
        ffmpeg(*inputs, "-filter_complex", vf + f";{last}format=yuv420p[out]", "-map", "[out]", "-an",
               "-t", f"{length:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "16", str(out))
        parts.append((out, length))

    inputs, chain, offset, prev = [], "", 0.0, "[0:v]"
    for path, _ in parts:
        inputs += ["-i", str(path)]
    for i in range(1, len(parts)):
        offset += parts[i - 1][1] - FADE
        chain += f"{prev}[{i}:v]xfade=transition=fadeblack:duration={FADE}:offset={offset:.3f}[x{i}];"
        prev = f"[x{i}]"
    joined = BUILD / "joined.mp4"
    ffmpeg(*inputs, "-filter_complex", chain + f"{prev}format=yuv420p[out]", "-map", "[out]", "-an",
           "-c:v", "libx264", "-preset", "slow", "-crf", "20", str(joined))

    # The settled hook card becomes the poster and the first frame, so every platform's thumbnail shows it.
    ffmpeg("-ss", "2.3", "-i", str(joined), "-frames:v", "1", "-q:v", "2", str(POSTER))
    ffmpeg("-i", str(joined), "-i", str(POSTER), "-filter_complex",
           "[0:v][1:v]overlay=0:0:enable='eq(n,0)',format=yuv420p[out]", "-map", "[out]", "-an",
           "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart", str(OUT))
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(OUT)],
                         capture_output=True, text=True).stdout.strip()
    print(f"wrote {OUT} ({float(dur):.1f}s, {OUT.stat().st_size / 1e6:.1f} MB) and {POSTER.name}")


if __name__ == "__main__":
    main()
