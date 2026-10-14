#!/bin/bash
# usage: shot.sh <url> <out.png> <width> <height>
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --window-size=$3,$4 --screenshot="$2" "$1" >/dev/null 2>&1
