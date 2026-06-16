#!/bin/bash
set -euo pipefail

echo "Performing 'aws cloudformation validate-template' check..."
aws cloudformation validate-template --template-body file://../template.yaml >/dev/null
echo "Success: CloudFormation template is valid."

echo ""
echo "Performing 'cfn-lint' check..."
cfn-lint ../template.yaml
echo "Success: cfn-lint checks passed."
