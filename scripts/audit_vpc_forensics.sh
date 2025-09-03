#!/usr/bin/env bash
set -euo pipefail

# Audit script: investigates unexpected VPC creation across regions
# - Scans repo for multi-region patterns
# - Scans GitHub workflows for hardcoded/variant regions
# - Queries CloudTrail for CreateVpc / CreateDefaultVpc events (last 90 days)

RED=$(tput setaf 1 || true)
GRN=$(tput setaf 2 || true)
YLW=$(tput setaf 3 || true)
BLU=$(tput setaf 4 || true)
RST=$(tput sgr0 || true)

start_ts="$(date -u -v-90d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '90 days ago' +%Y-%m-%dT%H:%M:%SZ)"
now_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "${BLU}🔎 VPC Forensics Audit${RST}"
echo "Time window: ${start_ts} → ${now_ts}"

mkdir -p forensics
out_json="forensics/vpc_create_events_$(date -u +%Y%m%dT%H%M%SZ).json"
out_csv="forensics/vpc_create_events_$(date -u +%Y%m%dT%H%M%SZ).csv"

echo "${BLU}1) Repo scan for multi-region patterns${RST}"
echo "${YLW}- Searching Terraform, workflows, and scripts for region usage...${RST}"
rg -n "provider\s+\"aws\"|alias\s*=|aws_region|region\s*:|aws-region|us-east-|us-west-|eu-|ap-|sa-" \
  --glob '!**/node_modules/**' --glob '!**/dist/**' || true

echo "${BLU}\n2) GitHub workflows region check${RST}"
if [ -d .github/workflows ]; then
  rg -n "aws-region:|AWS_REGION|region:" .github/workflows || true
else
  echo "(no workflows directory)"
fi

echo "${BLU}\n3) CloudTrail lookup for VPC creations (last 90 days)${RST}"
if ! command -v aws >/dev/null 2>&1; then
  echo "${RED}AWS CLI not found. Skipping CloudTrail lookup.${RST}" >&2
  exit 1
fi

acct_json=$(aws sts get-caller-identity --output json)
acct_id=$(printf "%s" "$acct_json" | jq -r .Account)
echo "Using AWS account: ${acct_id}"

regions=(
  us-west-2 us-west-1 us-east-1 us-east-2
  eu-west-1 eu-central-1 eu-west-2
  ap-northeast-1 ap-southeast-1 ap-south-1
  sa-east-1
)

echo "region,event,when,who,eventName,ip,userAgent,vpcId,cidr"
{
  echo 'region,event,when,who,ip,userAgent,vpcId,cidr'
} > "$out_csv"

tmp_json=$(mktemp)
echo '{"events":[]}' > "$tmp_json"

for r in "${regions[@]}"; do
  echo "${YLW}.. scanning ${r}${RST}" 1>&2
  for ev in CreateVpc CreateDefaultVpc; do
    res=$(aws cloudtrail lookup-events \
      --region "$r" \
      --start-time "$start_ts" \
      --end-time "$now_ts" \
      --lookup-attributes AttributeKey=EventName,AttributeValue=$ev \
      --output json || echo '{}')

    echo "$res" | jq -r --arg r "$r" --arg ev "$ev" '
      (.Events // [])[] |
      {region:$r,
       when:.EventTime,
       who:(.Username // ""),
       event:$ev,
       ip:((.CloudTrailEvent | fromjson | .sourceIPAddress) // ""),
       ua:((.CloudTrailEvent | fromjson | .userAgent) // ""),
       vpcId:((.CloudTrailEvent | fromjson | .responseElements.vpc.vpcId) // ""),
       cidr:((.CloudTrailEvent | fromjson | .requestParameters.cidrBlock) // "")}
      ' | while IFS= read -r line; do
        # Append to CSV
        region=$(echo "$line" | jq -r .region)
        when=$(echo "$line" | jq -r .when)
        who=$(echo "$line" | jq -r .who)
        ip=$(echo "$line" | jq -r .ip)
        ua=$(echo "$line" | jq -r .ua)
        vpc=$(echo "$line" | jq -r .vpcId)
        cidr=$(echo "$line" | jq -r .cidr)
        printf "%s,%s,%s,%s,%s,%s,%s,%s\n" "$region" "$ev" "$when" "$who" "$ip" "$ua" "$vpc" "$cidr"
        printf "%s,%s,%s,%s,%s,%s,%s,%s\n" "$region" "$when" "$who" "$ip" "$ua" "$vpc" "$cidr" "$ev" >> "$out_csv"
      done

    # Merge raw events JSON for deeper post-analysis
    echo "$res" | jq --arg r "$r" --arg ev "$ev" '
      {events: ((.Events // []) | map(. + {region:$r, eventName:$ev}))}
    ' > evt.json
    jq -s '{events: (.[0].events + .[1].events)}' "$tmp_json" evt.json > tmp.merge && mv tmp.merge "$tmp_json"
  done
done

mv "$tmp_json" "$out_json"

echo "${GRN}\n✔ Forensics complete${RST}"
echo "- CSV summary: $out_csv"
echo "- Raw JSON:    $out_json"

echo "${BLU}\nRecommended next steps:${RST}"
echo "- If you see CreateDefaultVpc events, capture the 'who' and 'ip' and check CloudTrail user identity details in the console."
echo "- Align region config: unify to a single region in Terraform and CI."
echo "- Add an IAM boundary/SCP to deny ec2:CreateVpc and ec2:CreateDefaultVpc outside approved regions."
