#!/usr/bin/env python3
"""Package and install vscode-yukino"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import urllib.parse
import urllib.request
import zipfile

WINDOWS = sys.platform == "win32"


def progress(message):
    print(message, flush=True)


def run(command, env, cwd=None, timeout=600):
    result = subprocess.run(command, cwd=cwd, env=env, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, encoding="utf-8",
                            errors="replace", timeout=timeout)
    if result.returncode:
        details = "\n".join(result.stdout.strip().splitlines()[-12:])
        raise RuntimeError(f"{Path(command[0]).name} {command[1]} exited with code {result.returncode}\n{details}")
    return result.stdout


def download(url, destination):
    request = urllib.request.Request(url, headers={"User-Agent": "yukino-installer"})
    with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
        size, received, last = int(response.headers.get("Content-Length", 0)), 0, -1
        while block := response.read(1024 * 1024):
            output.write(block)
            received += len(block)
            percent = received * 100 // size if size else -1
            if size and percent != last:
                print(f"\r  Download: {percent}%", end="", flush=True)
                last = percent
        if size:
            print()
            if received != size:
                raise RuntimeError("Incomplete download")


def extract(archive, destination):
    destination.mkdir()
    def safe(name):
        if ":" in name or not (destination / name.replace("\\", "/")).resolve().is_relative_to(destination.resolve()):
            raise RuntimeError("Unsafe archive path: " + name)
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive) as package:
            for entry in package.infolist():
                safe(entry.filename)
                if stat.S_ISLNK(entry.external_attr >> 16):
                    raise RuntimeError("ZIP symlink not allowed")
            package.extractall(destination)
    else:
        with tarfile.open(archive) as package:
            for entry in package:
                safe(entry.name)
                if entry.issym():
                    safe(str(Path(entry.name).parent / entry.linkname))
                elif entry.islnk():
                    safe(entry.linkname)
                elif not (entry.isfile() or entry.isdir()):
                    raise RuntimeError("Unsupported TAR entry type")
                package.extract(entry, destination, **({"filter": "data"} if hasattr(tarfile, "data_filter") else {}))
    directories = [p for p in destination.iterdir() if p.is_dir()]
    if len(directories) != 1:
        raise RuntimeError("Archive must have one root directory")
    return directories[0]


def runtime(root, env):
    node, npm = shutil.which("node"), shutil.which("npm")
    command = [npm] if npm else []
    if WINDOWS and npm:
        command = [node, str(Path(npm).resolve().parent / "node_modules/npm/bin/npm-cli.js")]
    def usable(node, command):
        try:
            return (int(run([node, "--version"], env, timeout=15).strip().lstrip("v").split(".")[0]) >= 22
                    and int(run(command + ["--version"], env, timeout=15).strip().split(".")[0]) >= 9)
        except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired):
            return False
    if node and command and usable(node, command):
        return command
    system = {"Windows": "win", "Linux": "linux"}.get(platform.system())
    arch = {"amd64": "x64", "x86_64": "x64", "arm64": "arm64", "aarch64": "arm64"}.get(platform.machine().lower())
    if not system or not arch:
        raise RuntimeError("No portable build for this platform. Install Node.js 22+ and npm 9+")
    progress("  Fetch portable Node.js")
    download("https://nodejs.org/dist/index.json", root / "index.json")
    target = f"{system}-{arch}" + ("-zip" if WINDOWS else "")
    releases = json.loads((root / "index.json").read_text())
    if not isinstance(releases, list):
        raise RuntimeError("Invalid Node.js release list")
    release = next((r for r in releases if isinstance(r, dict) and r.get("lts") and target in r.get("files", [])
                    and re.fullmatch(r"v\d+\.\d+\.\d+", r["version"]) and int(r["version"][1:].split(".")[0]) >= 22), None)
    if not release:
        raise RuntimeError("No matching Node.js LTS build")
    base = "https://nodejs.org/dist/" + release["version"] + "/"
    name = f"node-{release['version']}-{system}-{arch}" + (".zip" if WINDOWS else ".tar.gz")
    download(base + "SHASUMS256.txt", root / "sums.txt")
    expected = next((line.split()[0] for line in (root / "sums.txt").read_text().splitlines()
                     if len(line.split()) == 2 and line.split()[1].lstrip("*") == name), None)
    if expected is None:
        raise RuntimeError("Missing Node.js checksum")
    archive = root / name
    download(base + name, archive)
    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != expected:
        raise RuntimeError("Node.js checksum mismatch")
    portable = extract(archive, root / "node")
    bindir = portable if WINDOWS else portable / "bin"
    env["PATH"] = str(bindir) + os.pathsep + env.get("PATH", "")
    node = str(bindir / ("node.exe" if WINDOWS else "node"))
    command = [node, str(portable / ("node_modules/npm/bin/npm-cli.js" if WINDOWS else "lib/node_modules/npm/bin/npm-cli.js"))]
    if not usable(node, command):
        raise RuntimeError("Portable Node.js/npm failed version check")
    return command


def install(args, root):
    progress("[1/6] Find VS Code")
    code = args.code or shutil.which("code")
    if not code and WINDOWS:
        bases = [Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local")) / "Programs"]
        bases += [Path(os.environ[k]) for k in ("ProgramFiles", "ProgramFiles(x86)") if k in os.environ]
        code = next((str(p) for b in bases for p in [b / "Microsoft VS Code/bin/code.cmd"] if p.is_file()), None)
    if not code:
        raise RuntimeError("VS Code CLI not found. Install VS Code or use --code PATH")
    code = Path(shutil.which(code) or code).absolute()
    code_env = os.environ.copy()
    if WINDOWS:
        base = code.parent.parent if code.parent.name.lower() == "bin" else code.parent
        code = [str(base / "Code.exe"), str(base / "resources/app/out/cli.js")]
        if not all(Path(p).is_file() for p in code):
            raise RuntimeError("Missing Code.exe or cli.js. Point --code at bin/code.cmd")
        code_env["ELECTRON_RUN_AS_NODE"] = "1"
    else:
        if not code.is_file() or not os.access(code, os.X_OK):
            raise RuntimeError("VS Code CLI not executable: " + str(code))
        code = [str(code)]
    progress("[2/6] Set up Node.js and npm")
    env = os.environ.copy()
    env.update({"npm_config_cache": str(root / "npm-cache"), "npm_config_prefix": str(root / "npm-prefix"),
                "npm_config_global": "false", "npm_config_audit": "false", "npm_config_fund": "false",
                "npm_config_update_notifier": "false", "npm_config_loglevel": "error"})
    npm = runtime(root, env)
    progress("[3/6] Get source")
    if args.source:
        source = root / "source"
        shutil.copytree(args.source, source, ignore=shutil.ignore_patterns(".git", "node_modules", "out", "*.vsix", "__pycache__"))
    else:
        download("https://github.com/yukitsuri/vscode-yukino/archive/" + urllib.parse.quote(args.ref, safe="") + ".zip", root / "source.zip")
        source = extract(root / "source.zip", root / "source")
    manifest = json.loads((source / "package.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("publisher") != "shareui" or manifest.get("name") != "yukinolsp" or not isinstance(manifest.get("version"), str):
        raise RuntimeError("Invalid shareui.yukinolsp manifest")
    progress("[4/6] Install dependencies")
    run(npm + ["ci" if (source / "package-lock.json").exists() else "install", "--ignore-scripts", "--no-audit", "--no-fund"], env, source)
    progress("[5/6] Build VSIX")
    run(npm + ["run", "compile"], env, source, timeout=180)
    vsix = root / "yukinolsp.vsix"
    run(npm + ["exec", "--yes", "--package=@vscode/vsce@4.1.1", "--", "vsce", "package", "--no-yarn", "--out", str(vsix)], env, source)
    with zipfile.ZipFile(vsix) as package:
        built = json.loads(package.read("extension/package.json"))
        if not isinstance(built, dict) or package.testzip() or any(built.get(k) != manifest[k] for k in ("publisher", "name", "version")) or "extension/" + built.get("main", "").removeprefix("./") not in package.namelist():
            raise RuntimeError("Invalid VSIX")
    if args.output:
        output = Path(args.output).absolute()
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(vsix, output)
    profile = []
    for option in ("user_data_dir", "extensions_dir"):
        if getattr(args, option):
            profile += ["--" + option.replace("_", "-"), str(Path(getattr(args, option)).absolute())]
    progress("[6/6] Install extension")
    run(code + ["--install-extension", str(vsix), "--force"] + profile, code_env, timeout=180)
    try:
        installed = run(code + ["--list-extensions", "--show-versions"] + profile, code_env, timeout=30)
        if "shareui.yukinolsp@" + manifest["version"] not in {line.strip() for line in installed.lower().splitlines()}:
            raise RuntimeError("Expected extension version not found")
    except Exception as error:
        raise RuntimeError(f"Install ran, but verification failed: {error}") from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ("code", "source", "output", "user-data-dir", "extensions-dir"):
        parser.add_argument("--" + option)
    parser.add_argument("--ref", default="main")
    parser.add_argument("--keep-script", action="store_true")
    args = parser.parse_args()
    root, error, status = None, "", 0
    try:
        root = Path(tempfile.mkdtemp(prefix="yukino-vscode-"))
        install(args, root)
    except KeyboardInterrupt:
        error, status = "Install interrupted", 130
    except subprocess.TimeoutExpired:
        error, status = "Command timed out", 1
    except Exception as failure:
        error, status = str(failure), 1
    finally:
        if root:
            progress("Remove temp files")
            try:
                shutil.rmtree(root)
            except OSError as failure:
                error += f"\nCould not remove {root}: {failure}"
                status = 1
    if not status and not args.keep_script:
        try:
            Path(__file__).absolute().unlink()
        except OSError as failure:
            error, status = f"Installed, but script deletion failed: {failure}", 1
    if status:
        print("Error: " + error.strip() + "\nScript kept.", file=sys.stderr)
    else:
        progress("Installed. Reload the VS Code window.")
    return status


if __name__ == "__main__":
    sys.exit(main())
