#!/bin/bash

mkdir -p $PREFIX/bin
cp bin/varify.py $PREFIX/bin/varify
chmod +x $PREFIX/bin/varify

# Install pip-only dependencies
$PYTHON -m pip install --no-cache-dir vcfpy==0.13.8 dominate==2.9.1
