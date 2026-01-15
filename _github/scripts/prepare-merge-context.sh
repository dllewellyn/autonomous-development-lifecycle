#!/bin/bash
set -euo pipefail

git diff HEAD^ HEAD > merge_diff.txt
echo "Diff saved to merge_diff.txt"
