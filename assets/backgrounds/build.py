#!/usr/bin/env python3
"""One-shot rebuild of every background plate.

    python3 assets/backgrounds/build.py

Runs: generate.py (masters) -> encode.mjs (webp/avif/jpg) -> manifest.py.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "../.."))


def run(cmd):
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=ROOT, check=True)


def main():
    run([sys.executable, os.path.join(HERE, "generate.py")])
    run(["node", os.path.join(HERE, "encode.mjs")])
    run([sys.executable, os.path.join(HERE, "manifest.py")])
    print("\n✅ Backgrounds rebuilt -> public/backgrounds/")


if __name__ == "__main__":
    main()
