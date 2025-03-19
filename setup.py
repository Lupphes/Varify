from setuptools import setup, find_packages

setup(
    name='varify',
    version='1.0.0',
    packages=find_packages(),
    entry_points={
        'console_scripts': [
            'varify=varify.main:main',
        ],
    },
)
