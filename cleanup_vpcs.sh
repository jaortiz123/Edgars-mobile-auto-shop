#!/bin/bash

# AWS VPC Cleanup Script
# This script deletes default VPCs and their dependencies to reduce costs
# IMPORTANT: This will ONLY delete the specific default VPCs identified

set -e  # Exit on any error

echo "🧹 AWS VPC Cleanup Script"
echo "========================="
echo "This will delete unused default VPCs to save costs"
echo "⚠️  KEEPING: edgar-vpc in us-west-2 (your staging environment)"
echo ""

# Define the VPCs to delete (ONLY default VPCs from your scan)
# Format: "region:vpc-id"
vpcs_to_delete=(
    "us-east-1:vpc-08543987c7496e4af"
    "us-east-2:vpc-07ffe42b325110fb8"
    "us-west-1:vpc-0869e2ab2427fe1ba"
    "eu-west-1:vpc-0788f014aa3d93d38"
    "eu-central-1:vpc-08a8b645a12ba3e1d"
    "ap-northeast-1:vpc-0f76634f362ea291e"
    "ap-southeast-1:vpc-057551027c99765db"
)

# Optional: us-west-2 default VPC (you might want to keep this as backup)
# Uncomment the line below if you want to delete the us-west-2 default VPC too
# ["us-west-2"]="vpc-0202f44503428ce22"

delete_vpc_dependencies() {
    local region=$1
    local vpc_id=$2

    echo "🔍 Cleaning up dependencies for $vpc_id in $region..."

    # 1. Check and delete NAT Gateways (most expensive!)
    echo "   Checking for NAT Gateways..."
    nat_gateways=$(aws ec2 describe-nat-gateways --region $region --filter "Name=vpc-id,Values=$vpc_id" --query 'NatGateways[?State==`available`].NatGatewayId' --output text)

    if [[ -n "$nat_gateways" && "$nat_gateways" != "None" ]]; then
        echo "   💰 Found NAT Gateways: $nat_gateways"
        for ngw in $nat_gateways; do
            echo "   🗑️  Deleting NAT Gateway: $ngw (saves ~$45/month)"
            aws ec2 delete-nat-gateway --region $region --nat-gateway-id $ngw
        done
        echo "   ⏳ Waiting for NAT Gateways to delete..."
        sleep 30
    else
        echo "   ✅ No NAT Gateways found"
    fi

    # 2. Detach and delete Internet Gateways
    echo "   Checking for Internet Gateways..."
    igw_id=$(aws ec2 describe-internet-gateways --region $region --filters "Name=attachment.vpc-id,Values=$vpc_id" --query 'InternetGateways[0].InternetGatewayId' --output text)

    if [[ -n "$igw_id" && "$igw_id" != "None" ]]; then
        echo "   🔌 Detaching Internet Gateway: $igw_id"
        aws ec2 detach-internet-gateway --region $region --internet-gateway-id $igw_id --vpc-id $vpc_id

        echo "   🗑️  Deleting Internet Gateway: $igw_id"
        aws ec2 delete-internet-gateway --region $region --internet-gateway-id $igw_id
    else
        echo "   ✅ No Internet Gateway found"
    fi

    # 3. Delete Subnets
    echo "   Checking for Subnets..."
    subnet_ids=$(aws ec2 describe-subnets --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'Subnets[*].SubnetId' --output text)

    if [[ -n "$subnet_ids" && "$subnet_ids" != "None" ]]; then
        echo "   🗑️  Deleting subnets: $subnet_ids"
        for subnet in $subnet_ids; do
            aws ec2 delete-subnet --region $region --subnet-id $subnet
        done
    else
        echo "   ✅ No subnets found"
    fi

    # 4. Delete Security Groups (except default)
    echo "   Checking for custom Security Groups..."
    sg_ids=$(aws ec2 describe-security-groups --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text)

    if [[ -n "$sg_ids" && "$sg_ids" != "None" ]]; then
        echo "   🗑️  Deleting security groups: $sg_ids"
        for sg in $sg_ids; do
            aws ec2 delete-security-group --region $region --group-id $sg
        done
    else
        echo "   ✅ No custom security groups found"
    fi

    # 5. Delete Route Tables (except main)
    echo "   Checking for custom Route Tables..."
    rt_ids=$(aws ec2 describe-route-tables --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' --output text)

    if [[ -n "$rt_ids" && "$rt_ids" != "None" ]]; then
        echo "   🗑️  Deleting route tables: $rt_ids"
        for rt in $rt_ids; do
            aws ec2 delete-route-table --region $region --route-table-id $rt
        done
    else
        echo "   ✅ No custom route tables found"
    fi
}

delete_vpc() {
    local region=$1
    local vpc_id=$2

    echo "🗑️  Deleting VPC: $vpc_id in $region"
    if aws ec2 delete-vpc --region $region --vpc-id $vpc_id; then
        echo "   ✅ Successfully deleted VPC: $vpc_id"
    else
        echo "   ❌ Failed to delete VPC: $vpc_id"
        return 1
    fi
}

# Confirm before proceeding
echo "This will delete the following VPCs:"
for vpc_entry in "${vpcs_to_delete[@]}"; do
    region=${vpc_entry%:*}
    vpc_id=${vpc_entry#*:}
    echo "  - $region: $vpc_id (default VPC)"
done

echo ""
read -p "⚠️  Are you sure you want to proceed? (type 'yes' to continue): " confirm

if [[ "$confirm" != "yes" ]]; then
    echo "❌ Aborted by user"
    exit 1
fi

echo ""
echo "🚀 Starting cleanup..."

# Process each VPC
total_regions=${#vpcs_to_delete[@]}
current=1

for vpc_entry in "${vpcs_to_delete[@]}"; do
    region=${vpc_entry%:*}
    vpc_id=${vpc_entry#*:}

    echo ""
    echo "[$current/$total_regions] Processing $region..."
    echo "=================================="

    # Delete dependencies first
    if delete_vpc_dependencies $region $vpc_id; then
        # Then delete the VPC
        delete_vpc $region $vpc_id
        echo "✅ Completed cleanup for $region"
    else
        echo "❌ Failed to clean up dependencies for $region"
    fi

    ((current++))
    echo ""
done

echo "🎉 Cleanup completed!"
echo ""
echo "💰 Cost savings expected:"
echo "  - Eliminated cross-region networking costs"
echo "  - Removed unused Internet Gateways"
echo "  - Deleted any NAT Gateways (saves ~$45+ each per month)"
echo ""
echo "✅ Your staging environment in us-west-2 (edgar-vpc) is preserved"
