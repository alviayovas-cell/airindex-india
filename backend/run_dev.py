"""Local development server.

    python run_dev.py            # http://localhost:8010
    python run_dev.py --reload   # opt in to auto-reload (flaky on some Windows setups)
    APP_PORT=8020 python run_dev.py

Prefer this over `uvicorn ... --reload` on Windows: the reloader spawns a child
process that can hold the socket after exit, producing WinError 10013 on the next
start. This runs a single process on a non-8000 port to avoid common clashes.
"""

from __future__ import annotations

import argparse

import uvicorn

from app.config import settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AIRINDEX API (dev)")
    parser.add_argument("--port", type=int, default=settings.app_port)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        reload_dirs=["app"] if args.reload else None,
        log_level="info",
    )


if __name__ == "__main__":
    main()
