from setuptools import setup, find_packages

setup(
    name="varify",
    version="0.2.7",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    include_package_data=True,
    package_data={
        "varify": ["templates/*.html"],
    },
    install_requires=[
        "setuptools>=65.0",
        "pandas==2.2.3",
        "pysam==0.23.0",
        "vcfpy==0.13.8",
        "jinja2==3.1.6",
        "matplotlib==3.10.1",
        "seaborn==0.13.2",
        "numpy==2.2.4",
        "igv-reports==1.14.1",
        "kaleido==0.2.1",
        "plotly==6.0.1",
        "scipy==1.15.2",
    ],
    entry_points={
        "console_scripts": [
            "varify=varify.varify:main",
        ]
    },
    python_requires=">=3.10",
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
