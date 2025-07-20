import os
import json
import boto3
import logging

table_name = os.environ.get('CUSTOMERS_TABLE')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(table_name)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")
    # Extract user sub from JWT authorizer
    claims = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
    sub = claims.get('sub')
    if not sub:
        return {'statusCode': 401, 'body': json.dumps({'message': 'Unauthorized'})}

    pk = f"USER#{sub}"
    http_method = event.get('requestContext', {}).get('http', {}).get('method')

    if http_method == 'GET':
        # Query all items for this user
        resp = table.query(
            KeyConditionExpression="pk = :pk",
            ExpressionAttributeValues={':pk': pk}
        )
        items = resp.get('Items', [])
        # Build profile
        profile = {}
        vehicles = []
        for item in items:
            sk = item.get('sk', '')
            if sk == 'PROFILE':
                profile['email'] = item.get('email')
                profile['name'] = item.get('name')
                profile['phone'] = item.get('phone')
            elif sk.startswith('VEHICLE#'):
                vehicles.append({
                    'id': sk.split('#', 1)[1],
                    'make': item.get('make'),
                    'model': item.get('model'),
                    'year': item.get('year'),
                    'vin': item.get('vin')
                })
        profile['vehicles'] = vehicles
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(profile)
        }

    elif http_method == 'PUT':
        # Upsert profile and vehicles
        body = json.loads(event.get('body', '{}'))
        name = body.get('name')
        phone = body.get('phone')
        vehicles = body.get('vehicles', [])
        # Put PROFILE record; email from claims
        email = claims.get('email')
        table.put_item(Item={
            'pk': pk,
            'sk': 'PROFILE',
            'email': email,
            'name': name,
            'phone': phone
        })
        # Put each vehicle
        for v in vehicles:
            vid = v.get('id')
            if not vid:
                continue
            table.put_item(Item={
                'pk': pk,
                'sk': f"VEHICLE#{vid}",
                'make': v.get('make'),
                'model': v.get('model'),
                'year': v.get('year'),
                'vin': v.get('vin')
            })
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'message': 'updated'})
        }

    else:
        return {'statusCode': 405, 'body': json.dumps({'message': 'Method Not Allowed'})}
