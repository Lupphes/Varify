#!/bin/bash

# Install pip-based dependencies
$PYTHON -m pip install . --no-deps --ignore-installed
$PYTHON -m pip install vcfpy==0.13.8 dominate==2.9.1

# Create binary and make it executable
mkdir -p $PREFIX/bin
cp $SRC_DIR/bin/varify.py $PREFIX/bin/varify
chmod +x $PREFIX/bin/varify
