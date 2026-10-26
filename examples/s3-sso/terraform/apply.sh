#!/bin/sh
# Applies main.tf against moto, then hands the reader key to the signing
# proxy through the shared credentials volume. State stays in this
# container: moto keeps nothing on disk, so neither does the plan.
set -eu

workdir=/work
mkdir -p "$workdir"
# /src is mounted read-only and `terraform init` writes .terraform/ beside it.
cp /src/main.tf /src/.terraform.lock.hcl "$workdir/"
cd "$workdir"

terraform init -input=false -lockfile=readonly
terraform apply -input=false -auto-approve

umask 077
cat > /credentials/reader <<EOF
[default]
aws_access_key_id = $(terraform output -raw reader_access_key_id)
aws_secret_access_key = $(terraform output -raw reader_secret_access_key)
EOF
