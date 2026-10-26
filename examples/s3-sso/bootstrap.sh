#!/bin/sh
# Creates the deployer Terraform signs in as. moto runs with
# INITIAL_NO_AUTH_ACTION_COUNT=3, so exactly these three calls go through
# unauthenticated and every later request must carry a valid key.
set -eu

credentials=/credentials/deployer
# A live moto has already spent its three free calls; a second run would be
# refused, and the key it handed out is still valid.
if [ -f "$credentials" ]; then
  echo "deployer key already issued; skipping"
  exit 0
fi

export AWS_ACCESS_KEY_ID=bootstrap AWS_SECRET_ACCESS_KEY=bootstrap
iam="aws --endpoint-url http://moto:5000 --region us-east-1 iam"

$iam create-user --user-name deployer > /dev/null
key=$($iam create-access-key --user-name deployer \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
$iam put-user-policy --user-name deployer --policy-name administer \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}'

umask 077
printf '[default]\naws_access_key_id = %s\naws_secret_access_key = %s\n' \
  $key > "$credentials"
