"""
Quick diagnostic script to check what files Railway can see
Run this first: railway run python check_files.py
"""
import os
import sys

print("=" * 60)
print("Railway Environment Diagnostic")
print("=" * 60)
print(f"Current working directory: {os.getcwd()}")
print(f"Script location: {__file__}")
print(f"Script directory: {os.path.dirname(os.path.abspath(__file__))}")
print()
print("Files in current directory:")
try:
    files = os.listdir('.')
    for f in sorted(files):
        print(f"  - {f}")
except Exception as e:
    print(f"Error listing files: {e}")
print()
print("Files in backend directory:")
try:
    files = os.listdir(os.path.dirname(os.path.abspath(__file__)))
    for f in sorted(files):
        print(f"  - {f}")
except Exception as e:
    print(f"Error listing files: {e}")
print()
print("Checking for railway_data_ingestion.py:")
script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'railway_data_ingestion.py')
if os.path.exists(script_path):
    print(f"  ✓ Found at: {script_path}")
else:
    print(f"  ✗ Not found at: {script_path}")
print()
print("Checking for fdic_to_postgres.py in parent:")
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fdic_path = os.path.join(parent_dir, 'fdic_to_postgres.py')
if os.path.exists(fdic_path):
    print(f"  ✓ Found at: {fdic_path}")
else:
    print(f"  ✗ Not found at: {fdic_path}")
print()
print("Python path:")
for p in sys.path:
    print(f"  - {p}")
