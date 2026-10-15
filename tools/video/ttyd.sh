#!/usr/bin/env bash
# Serves a real bash shell in the browser for the terminal scenes of the demo video.
cd "$(dirname "$0")/../.."
export FELLOW_ROOT="$PWD" BASH_SILENCE_DEPRECATION_WARNING=1
exec ttyd -p 7681 -W -i 127.0.0.1 \
  -t fontSize=24 -t 'fontFamily=Roboto Mono' -t lineHeight=1.25 \
  -t 'theme={"background":"#14121A","foreground":"#EEF2F4","cursor":"#FFBDC5","selectionBackground":"#4C9DB0"}' \
  -t disableLeaveAlert=true -t disableResizeOverlay=true \
  bash --rcfile tools/video/demo.bashrc -i
