from setuptools import setup, find_packages
from setuptools.command.build_py import build_py
import os


class BuildWithAssets(build_py):
    """Custom build command that web assets are in package directory."""

    def run(self):
        project_root = os.path.dirname(os.path.abspath(__file__))
        target_dist = os.path.join(project_root, "src", "varify", "dist")

        for filename in ["bundle.js", "bundle.css"]:
            target_file = os.path.join(target_dist, filename)

            if not os.path.exists(target_file):
                print(f"Warning: {filename} not found at {target_file}")
                print("Run 'npm install && npm run build:package' to generate bundles")

        build_py.run(self)


setup(
    name="varify",
    version="3.0.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    include_package_data=True,
    package_data={
        "varify": [
            "templates/*.html",
            "dist/*.html",
            "dist/*.js",
            "dist/*.css",
        ],
    },
    cmdclass={
        "build_py": BuildWithAssets,
    },
    install_requires=[
        "numpy==2.2.4",
        "pandas==2.2.3",
        "pysam==0.23.0",
        "vcfpy==0.13.8",
        "python-dateutil==2.9.0.post0",
        "pytz==2025.2",
        "six==1.17.0",
        "tzdata==2025.2",
        "setuptools==80.9.0",
    ],
    entry_points={
        "console_scripts": [
            "varify=varify.cli:main",
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
