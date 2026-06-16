#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
PACKAGED_TEMPLATE="${PROJECT_DIR}/packaged-template.yaml"

# -----------------------------------------------------------------------------
# Validate Parameters
# -----------------------------------------------------------------------------
if [[ -f "${ENV_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
else
    echo "[Error]: Cannot deploy stack, missing .env file."
    exit 1
fi

STACK_NAME=${STACK_NAME:-twilio-aws-control}

echo "Checking template bucket exists..."

if [[ -z ${CF_BUCKET_NAME:-} ]]; then
    echo "[Error]: Cannot deploy stack, missing CF_BUCKET_NAME."
    exit 1
fi

if [[ -z ${AWS_REGION:-} ]]; then
    echo "[Error]: Cannot deploy stack, missing AWS_REGION."
    exit 1
fi

if [[ -z ${EC2_INSTANCE_ID:-} ]]; then
    echo "[Error]: Cannot deploy stack, missing EC2_INSTANCE_ID."
    exit 1
fi

if [[ -z ${PHONE_NO_WHITELIST:-} ]]; then
    echo "[Error]: Cannot deploy stack, missing PHONE_NO_WHITELIST."
    exit 1
fi

echo "CF_BUCKET_NAME=$CF_BUCKET_NAME"
echo "STACK_NAME=$STACK_NAME"

BUCKET_EXISTS=$(aws s3api list-buckets --query "Buckets[?Name=='${CF_BUCKET_NAME}'] | [0].Name" --output text)

if [[ $BUCKET_EXISTS == 'None' ]]; then
    echo "[Error]: Cannot deploy stack, bucket '$CF_BUCKET_NAME' doesn't exist."
    exit 1
fi

echo "Success!"
echo ""

# -----------------------------------------------------------------------------
# Packaging Template
# -----------------------------------------------------------------------------
echo "Packaging template..."

aws cloudformation package \
    --template-file "${PROJECT_DIR}/template.yaml" \
    --s3-bucket "$BUCKET_EXISTS" \
    --output-template-file "$PACKAGED_TEMPLATE" \
    --region "$AWS_REGION"

echo ""

# -----------------------------------------------------------------------------
# Deploying Stack
# -----------------------------------------------------------------------------
echo "Deploying stack..."

PARAMETER_OVERRIDES=(
    "EC2InstanceId=${EC2_INSTANCE_ID}"
    "PhoneNoWhitelist=${PHONE_NO_WHITELIST}"
)

if [[ -n ${PROJECT_ID:-} ]]; then
    PARAMETER_OVERRIDES+=("ProjectId=${PROJECT_ID}")
fi

if [[ -n ${TWILIO_VOICE:-} ]]; then
    PARAMETER_OVERRIDES+=("TwilioVoice=${TWILIO_VOICE}")
fi

aws cloudformation deploy \
    --template-file "$PACKAGED_TEMPLATE" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides "${PARAMETER_OVERRIDES[@]}" \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset \
    --region "$AWS_REGION"

echo ""
echo "Deployment complete."
