from setuptools import setup, find_packages

setup(
    name="varify",
    version="0.1.0",
    packages=find_packages(where="bin"),
    package_dir={"": "bin"},
    py_modules=["main"],  # Treat main.py as a standalone module
    install_requires=[
        "pandas==2.2.3",
        "plotly==6.0.1",
        "pysam==0.23.0",
        "vcfpy==0.13.8",
        "dominate==2.9.1"
    ],
    entry_points={
        "console_scripts": [
            "varify=main:main",  # Keep pointing to main.py directly
        ]
    },
    python_requires=">=3.12",
    author="Your Name",
    author_email="your.email@example.com",
    description="VCF and SURVIVOR Analysis Report Generator",
    url="https://github.com/yourusername/varify",
    license="MIT",
    classifiers=[
        "Programming Language :: Python :: 3.12",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
