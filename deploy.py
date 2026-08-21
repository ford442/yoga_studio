#!/usr/bin/env python3
"""
project_deploy_template.py

Copy this file into your project as `deploy.py` (or deploy_contabo.py).
Customize the constants at the top for your project.

Usage:
  1. python deploy.py              # validate shaders, rebuild out/, upload full bundle
  2. python deploy.py --skip-build # upload an existing out/ directory
  3. Set DEPLOY_TOKEN in the environment (required)

This script contacts https://storage.noahcohn.com (your Contabo storage manager)
to upload your entire build as a single zip archive.  The server extracts it and
pushes all files over one persistent SFTP connection — much faster than uploading
files individually.

Actual FTP/SFTP credentials never leave the VPS.

Requirements:
  pip install requests
"""

import argparse
import io
import os
import subprocess
import sys
import zipfile
from pathlib import Path

import requests

# ============================================================
# PER-PROJECT CONFIGURATION - EDIT THESE
# ============================================================
PROJECT_NAME: str = 'yoga'
BUILD_DIR: str = 'out'
CONTABO_BASE_URL: str = "https://storage.noahcohn.com"
DEPLOY_FOLDER: str = ""  # override remote target folder; empty = use PROJECT_NAME

# Deploy token is required and must come from the environment:
#   export DEPLOY_TOKEN="your_long_token_from_vps_env"
DEPLOY_TOKEN: str = os.environ.get("DEPLOY_TOKEN") or ""
# ============================================================
DEPLOY_TARGET: str = os.environ.get("DEPLOY_TARGET") or "go"


def run_full_rebuild() -> None:
    """Validate shaders (via prebuild) and produce a fresh static export."""
    print("Running full production rebuild (`npm run build`)...")
    result = subprocess.run(["npm", "run", "build"], check=False)
    if result.returncode != 0:
        print("ERROR: `npm run build` failed; refusing to deploy a stale or partial tree.")
        sys.exit(result.returncode)


def build_zip(build_path: Path) -> bytes:
    """Zip every file under build_path into an in-memory archive (no size-skip)."""
    buf = io.BytesIO()
    count = 0
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file in sorted(build_path.rglob("*")):
            if file.is_dir():
                continue
            rel = file.relative_to(build_path)
            parts = rel.parts
            if any(p in (".git", "node_modules", "__pycache__") for p in parts):
                continue
            rel_s = str(rel).replace("\\", "/")
            zf.write(file, rel_s)
            count += 1
            print(f"  + {rel}")
    print(f"Archived {count} file(s) for a full deploy")
    return buf.getvalue()


def deploy_bundle(build_path: Path) -> bool:
    """Zip the build and upload it as a single full bundle."""
    target_folder = DEPLOY_FOLDER or PROJECT_NAME
    url = f"{CONTABO_BASE_URL}/api/deploy/{PROJECT_NAME}/bundle"
    headers = {}
    if DEPLOY_TOKEN:
        headers["X-Deploy-Token"] = DEPLOY_TOKEN

    print("Building zip archive of the complete export...")
    zip_bytes = build_zip(build_path)
    print(f"Archive size: {len(zip_bytes) / 1024:.1f} KB\n")

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as _zf:
        if not _zf.namelist():
            print("ERROR: Build zip is empty; refusing to deploy.")
            return False

    print(f"Uploading full bundle (target_folder={target_folder}, target_site={DEPLOY_TARGET})...")
    try:
        response = requests.post(
            url,
            files={"bundle": ("build.zip", zip_bytes, "application/zip")},
            data={
                "target_folder": target_folder,
                "target_site": DEPLOY_TARGET,
                "full": "1",
            },
            headers=headers,
            timeout=300,
        )
    except Exception as exc:
        print(f"  \u2717 Upload exception: {exc}")
        return False

    if response.status_code == 200:
        data = response.json()
        print(f"  \u2713 {data.get('uploaded', 0)} files uploaded")
        if data.get("failed"):
            print("  Failures:")
            for f in data["failed"]:
                print(f"    \u2717 {f['path']}: {f['error']}")
        return not data.get("failed")
    print(f"  \u2717 {response.status_code}: {response.text[:400]}")
    return False


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rebuild and fully deploy the static export.")
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Do not run `npm run build`; upload the existing out/ directory.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if not DEPLOY_TOKEN:
        print("ERROR: Set DEPLOY_TOKEN in your environment before running deploy.py")
        sys.exit(1)
    print(f"\n=== Deploying '{PROJECT_NAME}' via Contabo -> storage.1ink.us ===\n")

    if not args.skip_build:
        run_full_rebuild()
    else:
        print("Skipping rebuild (--skip-build); using existing out/ contents.")

    build_path = Path(BUILD_DIR)
    if not build_path.exists() or not build_path.is_dir():
        print(f"ERROR: Build directory '{BUILD_DIR}/' does not exist.")
        print("Please run `npm run build` first, or omit --skip-build.")
        sys.exit(1)

    try:
        health = requests.get(f"{CONTABO_BASE_URL}/api/deploy/health", timeout=10)
        if health.status_code == 200:
            print(f"Contabo deploy service: {health.json().get('status', 'unknown')}")
    except Exception:
        print("Warning: Could not contact storage.noahcohn.com (continuing anyway).")

    print(f"\nUploading full bundle from {BUILD_DIR}/ ...\n")

    success = deploy_bundle(build_path)

    print(f"\n=== {'Deployment complete' if success else 'Deployment finished with errors'} ===")
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
