from setuptools import setup, find_packages

setup(
    name='varify',
    version='0.0.1',
    packages=find_packages(),
    entry_points={
        'console_scripts': [
            'varify=varify.main:main',
        ],
    },
)
