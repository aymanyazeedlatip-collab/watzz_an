from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
"""Safe Gemini configuration diagnostic. Never prints the API key."""
from app.config import refresh_gemini_settings, settings

info = refresh_gemini_settings()
print("WATTZAN Gemini configuration check")
print("Configured:", info["configured"])
print("Source:", info["configuration_source"] or "none")
print("Detected key length:", info["key_length"])
print("Model:", settings.gemini_model)
print("Existing candidate files:")
for path in info["existing_files"]:
    print(" -", path)
if info["placeholder_files"]:
    print("Files that still contain a placeholder:")
    for path in info["placeholder_files"]:
        print(" -", path)
if info["key_only_in_env_example"]:
    print("WARNING: A real-looking key was found only in .env.example. Move it to backend/.env.")
if not info["configured"]:
    print("Checked paths:")
    for path in info["checked_paths"]:
        print(" -", path)
