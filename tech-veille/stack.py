"""Inventory of what really runs on the VPS: direct dependencies and key system packages.

Projects = working directories of the systemd services under /opt, plus a few
extra paths (Blindz runs in Docker). Only direct production dependencies are
listed, so the report stays about things Tym actually chose and can upgrade.
"""
from __future__ import annotations

import json
import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

import yaml

log = logging.getLogger(__name__)

OPT = Path("/opt")
SYSTEMD_DIR = Path("/etc/systemd/system")
EXTRA_PROJECTS = [Path("/opt/blindify/backend")]  # Blindz backend runs in Docker
UBUNTU_ECOSYSTEM = "Ubuntu:24.04:LTS"
# Ubuntu source packages worth watching (security updates usually land, this checks they did)
SYSTEM_PACKAGES = ["nginx", "openssh", "postgresql-16", "redis", "openssl", "sudo", "curl", "git"]
LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "composer.lock", "requirements.txt"]

# Dependency names → how news articles call them (only names unlikely to match by accident)
WELL_KNOWN = {
    "next": "Next.js", "react": "React", "@prisma/client": "Prisma", "prisma": "Prisma",
    "express": "Express", "fastify": "Fastify", "socket.io": "Socket.IO", "ioredis": "Redis",
    "redis": "Redis", "pg": "PostgreSQL", "postgresql-16": "PostgreSQL", "vite": "Vite",
    "astro": "Astro", "nodemailer": "Nodemailer", "jsonwebtoken": "jsonwebtoken",
    "bcryptjs": "bcrypt", "sharp": "sharp", "axios": "axios", "undici": "undici",
    "@shopify/shopify-api": "Shopify API", "fastapi": "FastAPI", "uvicorn": "uvicorn",
    "flask": "Flask", "django": "Django", "requests": "Python requests", "torch": "PyTorch",
    "transformers": "Hugging Face Transformers", "symfony/http-kernel": "Symfony",
    "symfony/framework-bundle": "Symfony", "twig/twig": "Twig", "doctrine/orm": "Doctrine",
    "nginx": "nginx", "openssh": "OpenSSH", "openssl": "OpenSSL", "sudo": "sudo",
}
ALWAYS_KEYWORDS = ["Node.js", "Ollama", "Docker", "Ubuntu", "Discord"]


@dataclass(frozen=True)
class Dep:
    ecosystem: str
    name: str
    version: str
    projects: tuple[str, ...]


# ─── Parsers (pure) ───────────────────────────────────────────────

def parse_package_lock(lock: dict) -> list[tuple[str, str, str]]:
    """Direct dependencies of the root and of npm workspaces (keys without node_modules/)."""
    packages = lock.get("packages") or {}
    found: dict[str, str] = {}
    for path, meta in packages.items():
        if "node_modules/" in path or not isinstance(meta, dict):
            continue
        prefix = f"{path}/" if path else ""
        for name in meta.get("dependencies") or {}:
            entry = packages.get(f"{prefix}node_modules/{name}") or packages.get(f"node_modules/{name}") or {}
            if entry.get("version") and not entry.get("link"):
                found[name] = entry["version"]
    return [("npm", n, v) for n, v in sorted(found.items())]


def parse_pnpm_lock(lock: dict) -> list[tuple[str, str, str]]:
    found: dict[str, str] = {}
    for importer in (lock.get("importers") or {}).values():
        for name, spec in ((importer or {}).get("dependencies") or {}).items():
            version = str((spec or {}).get("version", "")) if isinstance(spec, dict) else str(spec)
            if not version or version.startswith(("link:", "file:", "workspace:")):
                continue
            found[name] = version.split("(", 1)[0]
    return [("npm", n, v) for n, v in sorted(found.items())]


def parse_composer_lock(lock: dict, require: dict) -> list[tuple[str, str, str]]:
    wanted = {n for n in require if n != "php" and not n.startswith("ext-")}
    out = [("Packagist", p["name"], p["version"]) for p in lock.get("packages") or []
           if p.get("name") in wanted and p.get("version")]
    return sorted(out)


_REQ = re.compile(r"^\s*([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*(==\s*([^\s;#]+))?")


def parse_requirements(text: str, installed: dict[str, str]) -> list[tuple[str, str, str]]:
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(("#", "-")):
            continue
        m = _REQ.match(line)
        if not m:
            continue
        name = m.group(1)
        version = m.group(3) or installed.get(name.lower().replace("_", "-"))
        if version:
            out.append(("PyPI", name, version))
    return out


def installed_python(venv: Path) -> dict[str, str]:
    """Versions from a virtualenv's *.dist-info folders."""
    out = {}
    for info in venv.glob("lib/python*/site-packages/*.dist-info"):
        name, _, version = info.name.removesuffix(".dist-info").rpartition("-")
        if name:
            out[name.lower().replace("_", "-")] = version
    return out


def keywords(deps: list[Dep]) -> list[str]:
    names = [WELL_KNOWN[d.name] for d in deps if d.name in WELL_KNOWN]
    return sorted(set(names), key=str.lower)


# ─── Discovery ────────────────────────────────────────────────────

def find_lockfile(start: Path, stop: Path = OPT) -> Path | None:
    current = start
    while True:
        for name in LOCKFILES:
            candidate = current / name
            if candidate.is_file():
                return candidate
        if current == stop or current.parent == current or stop not in current.parents:
            return None
        current = current.parent


def service_dirs() -> list[Path]:
    dirs = set()
    for unit in SYSTEMD_DIR.glob("*.service"):
        try:
            for line in unit.read_text(errors="ignore").splitlines():
                if line.startswith("WorkingDirectory=/opt/"):
                    path = Path(line.split("=", 1)[1].strip())
                    if path.is_dir():
                        dirs.add(path)
        except OSError:
            continue
    return sorted(dirs | {p for p in EXTRA_PROJECTS if p.is_dir()})


def project_name(lockfile: Path) -> str:
    rel = lockfile.parent.relative_to(OPT)
    return str(rel)


def read_lockfile(path: Path) -> list[tuple[str, str, str]]:
    try:
        if path.name == "package-lock.json":
            return parse_package_lock(json.loads(path.read_text()))
        if path.name == "pnpm-lock.yaml":
            return parse_pnpm_lock(yaml.safe_load(path.read_text()) or {})
        if path.name == "composer.lock":
            require = json.loads((path.parent / "composer.json").read_text()).get("require", {})
            return parse_composer_lock(json.loads(path.read_text()), require)
        if path.name == "requirements.txt":
            installed: dict[str, str] = {}
            for venv in ("venv", ".venv"):
                installed |= installed_python(path.parent / venv)
            return parse_requirements(path.read_text(), installed)
    except (OSError, ValueError, yaml.YAMLError, KeyError):
        log.warning("Could not read %s", path, exc_info=True)
    return []


def system_packages() -> list[tuple[str, str, str]]:
    try:
        out = subprocess.run(
            ["dpkg-query", "-W", "-f=${source:Package} ${Version}\\n"],
            capture_output=True, text=True, timeout=30, check=True,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        log.warning("dpkg-query failed, system packages skipped")
        return []
    found = {}
    for line in out.splitlines():
        name, _, version = line.partition(" ")
        if name in SYSTEM_PACKAGES and version:
            found[name] = version
    return [(UBUNTU_ECOSYSTEM, n, v) for n, v in sorted(found.items())]


def scan() -> list[Dep]:
    by_key: dict[tuple[str, str, str], set[str]] = {}
    seen_files = set()
    for directory in service_dirs():
        lockfile = find_lockfile(directory)
        if not lockfile or lockfile in seen_files:
            continue
        seen_files.add(lockfile)
        project = project_name(lockfile)
        for key in read_lockfile(lockfile):
            by_key.setdefault(key, set()).add(project)
    for key in system_packages():
        by_key.setdefault(key, set()).add("système")
    return [Dep(e, n, v, tuple(sorted(p))) for (e, n, v), p in sorted(by_key.items())]


# ─── News about the stack ─────────────────────────────────────────

SECURITY_WORDS = re.compile(
    r"\b(?:cve-\d{4}-\d+|vulnerab\w*|exploit\w*|faille\w*|zero[- ]day|0-day|rce|"
    r"remote code execution|bypass\w*|injection|xss|ssrf|backdoor\w*|malware|"
    r"compromis\w*|compromised|patch(?:ed|es)?|security (?:fix|update|advisory)|advisory)\b",
    re.IGNORECASE,
)
# Most exposed first: these get an extra Hacker News search each run.
NEWS_PRIORITY = ["Next.js", "nginx", "Node.js", "PostgreSQL", "Prisma", "Redis", "OpenSSH",
                 "OpenSSL", "Docker", "Ollama", "React", "Express", "FastAPI", "Symfony"]


def _mention(word: str, text: str) -> bool:
    return re.search(rf"(?<![\w.]){re.escape(word)}(?![\w])", text, re.IGNORECASE) is not None


def stack_security_hits(text: str, words: list[str]) -> list[str]:
    """Stack names mentioned in a text that is about security."""
    if not words or not SECURITY_WORDS.search(text):
        return []
    return [w for w in words if _mention(w, text)]


# Stack name → GitHub repo whose stable releases we follow (security fixes land there first)
STACK_REPOS = {
    "Next.js": {"repo": "vercel/next.js"},
    "Prisma": {"repo": "prisma/prisma"},
    "Node.js": {"repo": "nodejs/node"},
    "Ollama": {"repo": "ollama/ollama"},
    "Express": {"repo": "expressjs/express"},
    "Socket.IO": {"repo": "socketio/socket.io", "tag_prefix": "socket.io@"},
    "nginx": {"repo": "nginx/nginx"},
    "Redis": {"repo": "redis/redis"},
    "Vite": {"repo": "vitejs/vite", "tag_prefix": "v"},
    "FastAPI": {"repo": "fastapi/fastapi"},
    "React": {"repo": "facebook/react"},
    "Nodemailer": {"repo": "nodemailer/nodemailer"},
    "axios": {"repo": "axios/axios"},
    "Hugging Face Transformers": {"repo": "huggingface/transformers"},
    "Docker": {"repo": "moby/moby", "tag_prefix": "docker-"},
}
STACK_REPO_SCORE = 6


def stack_repos(words: list[str]) -> list[dict]:
    out = []
    for word in words:
        cfg = STACK_REPOS.get(word)
        if cfg and all(r["repo"] != cfg["repo"] for r in out):
            out.append({**cfg, "label": word, "category": "tech", "score": STACK_REPO_SCORE})
    return out


def news_queries(words: list[str], limit: int = 8) -> list[str]:
    present = [w for w in NEWS_PRIORITY if w in words]
    return [f"{w} vulnerability" for w in present[:limit]]
