"""
Project-root entrypoint for Railway when root directory is the repo (not backend/).

Prefer (backend root directory):
  railway run python railway_data_ingestion.py

See docs/RAILWAY_DATA_REFRESH.md
"""
import os
import sys

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fdic_optimized_ingestion import main  # noqa: E402

if __name__ == "__main__":
    main()
