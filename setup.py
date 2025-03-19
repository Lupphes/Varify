from setuptools import setup, find_packages

setup(
    name='varify',
    version='0.0.1',
    packages=find_packages('bin'),
    package_dir={'': 'bin'},
    entry_points={
        'console_scripts': [
            'varify = varify.main:main'
        ]
    },
    install_requires=[
        'pandas==2.2.3',
        'plotly==6.0.1',
        'vcfpy==0.13.8',
        'dominate==2.9.1'
    ],
)
