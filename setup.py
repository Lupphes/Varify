from setuptools import setup, find_packages

setup(
    name="varify",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "setuptools>=65.0",
        "pandas==2.2.3",
        "plotly==6.0.1",
        "pysam==0.23.0",
        "vcfpy==0.13.8",
        "dominate==2.9.1"
    ],
    entry_points={
        "console_scripts": [
            "varify=varify.varify:main",
        ]
    },
    python_requires=">=3.12",
    author="Ondřej Sloup",
    author_email="dev@lupphes.com",
    description="Variant File Report Generator",
    url="https://github.com/lupphes/varify",
    license="GPL-3.0-or-later",
    classifiers=[
        "Programming Language :: Python :: 3.12",
        "License :: OSI Approved :: GNU General Public License v3 or later (GPLv3+)",
        "Operating System :: OS Independent",
    ],
)
