"""
EC2EZ Setup Configuration
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="ec2ez",
    version="1.1.0",
    author="EC2EZ Contributors",
    description="AWS IMDSv2 Exploitation Tool for Authorized Security Testing",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/ec2ez-python",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Information Technology",
        "Topic :: Security",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "boto3>=1.34.0",
        "botocore>=1.34.0",
        "requests>=2.31.0",
    ],
    entry_points={
        "console_scripts": [
            "ec2ez=ec2ez:main",
        ],
    },
)
