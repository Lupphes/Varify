#!/bin/bash

# Create the bin directory
mkdir -p $PREFIX/bin

# Copy the entire varify folder (which includes main.py and varify.py)
cp -r $SRC_DIR/bin/varify $PREFIX/bin/

# Make sure the main.py file is executable
chmod +x $PREFIX/bin/varify/main.py

# Create a symlink so 'varify' points to 'main.py'
ln -s $PREFIX/bin/varify/main.py $PREFIX/bin/varify
