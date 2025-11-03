from setuptools import setup, find_packages
from setuptools.command.build_py import build_py
import os
import shutil


class BuildWithAssets(build_py):
    """Custom build command that copies web assets to package directory."""

    def run(self):
        project_root = os.path.dirname(os.path.abspath(__file__))
        source_dist = os.path.join(project_root, "dist")
        target_dist = os.path.join(project_root, "src", "varify", "dist")

        os.makedirs(target_dist, exist_ok=True)

        for filename in ["bundle.js", "bundle.css"]:
            source_file = os.path.join(source_dist, filename)
            target_file = os.path.join(target_dist, filename)

            if os.path.exists(source_file):
                shutil.copy2(source_file, target_file)
                print(f"Copied {filename} to package directory")
            else:
                print(f"Warning: {filename} not found at {source_file}")
                print("Run 'npm run build:report' to generate bundles")

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
