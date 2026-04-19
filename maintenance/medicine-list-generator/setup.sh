#!/usr/bin/env bash
# Set up the Python virtual environment for medicine-list-generator.
# Run from the maintenance/medicine-list-generator/ directory.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Resolve activate path — Windows venvs use Scripts/, Unix uses bin/
if [ -f ".venv/Scripts/activate" ]; then
  ACTIVATE=".venv/Scripts/activate"
elif [ -f ".venv/bin/activate" ]; then
  ACTIVATE=".venv/bin/activate"
else
  echo "Creating virtual environment..."
  python -m venv .venv
  if [ -f ".venv/Scripts/activate" ]; then
    ACTIVATE=".venv/Scripts/activate"
  else
    ACTIVATE=".venv/bin/activate"
  fi
fi

# shellcheck disable=SC1090
source "$ACTIVATE"
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo ""
echo "Setup complete. Activate with:"
echo "  source $ACTIVATE"
echo ""
echo "Then run:"
echo "  python src/update_medications.py"
