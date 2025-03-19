#!/bin/bash

mkdir -p $PREFIX/bin
cp $SRC_DIR/bin/varify.py $PREFIX/bin/varify.py
chmod +x $PREFIX/bin/varify.py


# Install pip-only dependencies
$PYTHON -m pip install --no-cache-dir vcfpy==0.13.8 dominate==2.9.1
