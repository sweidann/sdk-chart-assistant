#!/bin/bash
# Activation script for the export service virtual environment
source venv/bin/activate
echo "✅ Virtual environment activated!"
echo "Python version: $(python --version)"
echo "FastAPI location: $(python -c 'import fastapi; print(fastapi.__file__)')"
echo ""
echo "Available commands:"
echo "  uvicorn app.main:app --reload    # Start development server"
echo "  python -m app.main               # Run directly"
echo "  deactivate                       # Exit virtual environment"
