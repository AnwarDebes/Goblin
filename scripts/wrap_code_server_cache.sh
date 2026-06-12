#!/bin/bash
# Patch the cached code-server tarball(s) so the bin/code-server launcher
# also starts Goblin. The Coder template extracts and runs this launcher at
# every workspace boot, which gives us a zero-touch autostart hook.
# Idempotent: skips tarballs already patched (marker line).
set -euo pipefail

CACHE_DIR="/home/coder/.cache/code-server"
HOOK='[ -x /home/coder/Goblin/scripts/goblin_autostart.sh ] && (bash /home/coder/Goblin/scripts/goblin_autostart.sh >/dev/null 2>&1 &) # goblin-hook'

# Only the newest cached version matters: the boot script installs the
# latest release, so older tarballs are never reused (several are corrupt).
NEWEST=$(ls "$CACHE_DIR"/code-server-*-linux-amd64.tar.gz 2>/dev/null | sort -V | tail -1)

for TARBALL in $NEWEST; do
    [ -f "$TARBALL" ] || continue
    # already patched?
    if tar -xzOf "$TARBALL" --wildcards '*/bin/code-server' 2>/dev/null | grep -q goblin-hook; then
        continue
    fi
    WORK=$(mktemp -d)
    if ! tar -xzf "$TARBALL" -C "$WORK" 2>/dev/null; then
        echo "WARN: $(basename "$TARBALL") did not extract cleanly, skipping"
        rm -rf "$WORK"
        continue
    fi
    LAUNCHER=$(find "$WORK" -path '*/bin/code-server' -type f | head -1)
    if [ -z "$LAUNCHER" ]; then
        echo "WARN: no bin/code-server in $TARBALL, skipping"
        rm -rf "$WORK"
        continue
    fi
    # insert hook after the shebang line
    sed -i "1a $HOOK" "$LAUNCHER"
    TOPDIR=$(ls "$WORK")
    # Build in /tmp (local disk): the ceph home mount silently truncates
    # large writes when flaky. Then copy out with checksum verification.
    LOCAL=$(mktemp /tmp/cs-patched-XXXX.tar.gz)
    tar -czf "$LOCAL" -C "$WORK" "$TOPDIR"
    gzip -t "$LOCAL"
    SUM=$(sha256sum "$LOCAL" | cut -d' ' -f1)
    OK=false
    for attempt in 1 2 3 4 5; do
        cp "$LOCAL" "$TARBALL.tmp" && sync
        if [ "$(sha256sum "$TARBALL.tmp" | cut -d' ' -f1)" = "$SUM" ]; then
            mv "$TARBALL.tmp" "$TARBALL"
            OK=true
            break
        fi
        echo "WARN: copy to cache corrupted (attempt $attempt), retrying"
        sleep 3
    done
    rm -f "$LOCAL" "$TARBALL.tmp"
    rm -rf "$WORK"
    if $OK; then
        echo "patched: $(basename "$TARBALL")"
    else
        echo "ERROR: could not write verified tarball for $(basename "$TARBALL")"
        exit 1
    fi
done
