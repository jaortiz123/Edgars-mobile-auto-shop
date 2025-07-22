import json
import boto3
import os
from datetime import datetime, timedelta
from decimal import Decimal
import logging

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Lambda function to provide notification tracking API for admin dashboard
    Supports querying notification history and statistics
    """
    
    try:
        # Get DynamoDB table name from environment
        table_name = os.environ.get('NOTIFICATION_TRACKING_TABLE')
        if not table_name:
            raise ValueError("NOTIFICATION_TRACKING_TABLE environment variable not set")
        
        table = dynamodb.Table(table_name)
        
        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        path = event.get('path', '')
        
        if path.endswith('/stats'):
            # Return notification statistics
            return get_notification_stats(table)
        elif path.endswith('/recent'):
            # Return recent notifications
            limit = int(query_params.get('limit', 50))
            return get_recent_notifications(table, limit)
        elif path.endswith('/failed'):
            # Return failed notifications
            return get_failed_notifications(table)
        else:
            # Return all notifications with optional filtering
            appointment_id = query_params.get('appointment_id')
            notification_type = query_params.get('type')
            status = query_params.get('status')
            
            return get_notifications(table, appointment_id, notification_type, status)
        
    except Exception as e:
        logger.error(f"Error in notification tracking API: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }, default=decimal_default)
        }

def get_notification_stats(table):
    """Get notification statistics"""
    try:
        # Scan table for statistics (in production, consider using GSI for better performance)
        response = table.scan()
        items = response['Items']
        
        # Calculate statistics
        total_notifications = len(items)
        sent_count = len([item for item in items if item.get('status') == 'sent'])
        failed_count = len([item for item in items if item.get('status') == 'failed'])
        pending_count = len([item for item in items if item.get('status') == 'pending'])
        
        # Get recent statistics (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_items = [
            item for item in items 
            if datetime.fromisoformat(item.get('timestamp', '1970-01-01T00:00:00')) > seven_days_ago
        ]
        
        # Count by notification type
        type_counts = {}
        for item in items:
            notification_type = item.get('notification_type', 'unknown')
            type_counts[notification_type] = type_counts.get(notification_type, 0) + 1
        
        stats = {
            'total_notifications': total_notifications,
            'sent_count': sent_count,
            'failed_count': failed_count,
            'pending_count': pending_count,
            'success_rate': (sent_count / total_notifications * 100) if total_notifications > 0 else 0,
            'recent_7_days': len(recent_items),
            'by_type': type_counts,
            'last_updated': datetime.utcnow().isoformat()
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(stats, default=decimal_default)
        }
        
    except Exception as e:
        logger.error(f"Error getting notification stats: {str(e)}")
        raise

def get_recent_notifications(table, limit=50):
    """Get recent notifications"""
    try:
        # Scan table and sort by timestamp (in production, use GSI with timestamp)
        response = table.scan()
        items = response['Items']
        
        # Sort by timestamp (most recent first)
        sorted_items = sorted(
            items,
            key=lambda x: x.get('timestamp', '1970-01-01T00:00:00'),
            reverse=True
        )
        
        # Limit results
        limited_items = sorted_items[:limit]
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'notifications': limited_items,
                'count': len(limited_items),
                'total_available': len(items)
            }, default=decimal_default)
        }
        
    except Exception as e:
        logger.error(f"Error getting recent notifications: {str(e)}")
        raise

def get_failed_notifications(table):
    """Get failed notifications for troubleshooting"""
    try:
        # Use filter expression to get only failed notifications
        response = table.scan(
            FilterExpression='#status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'failed'}
        )
        
        items = response['Items']
        
        # Sort by timestamp (most recent first)
        sorted_items = sorted(
            items,
            key=lambda x: x.get('timestamp', '1970-01-01T00:00:00'),
            reverse=True
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'failed_notifications': sorted_items,
                'count': len(sorted_items)
            }, default=decimal_default)
        }
        
    except Exception as e:
        logger.error(f"Error getting failed notifications: {str(e)}")
        raise

def get_notifications(table, appointment_id=None, notification_type=None, status=None):
    """Get notifications with optional filtering"""
    try:
        if appointment_id and notification_type:
            # Query by primary key
            response = table.get_item(
                Key={
                    'appointment_id': appointment_id,
                    'notification_type': notification_type
                }
            )
            
            if 'Item' in response:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'notification': response['Item']
                    }, default=decimal_default)
                }
            else:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Notification not found'})
                }
        
        elif appointment_id:
            # Query by appointment_id (partition key)
            response = table.query(
                KeyConditionExpression='appointment_id = :appointment_id',
                ExpressionAttributeValues={':appointment_id': appointment_id}
            )
            
            items = response['Items']
            
        else:
            # Scan with optional filters
            scan_kwargs = {}
            filter_expressions = []
            expression_values = {}
            expression_names = {}
            
            if status:
                filter_expressions.append('#status = :status')
                expression_names['#status'] = 'status'
                expression_values[':status'] = status
            
            if notification_type:
                filter_expressions.append('notification_type = :notification_type')
                expression_values[':notification_type'] = notification_type
            
            if filter_expressions:
                scan_kwargs['FilterExpression'] = ' AND '.join(filter_expressions)
                scan_kwargs['ExpressionAttributeValues'] = expression_values
                if expression_names:
                    scan_kwargs['ExpressionAttributeNames'] = expression_names
            
            response = table.scan(**scan_kwargs)
            items = response['Items']
        
        # Sort by timestamp (most recent first)
        sorted_items = sorted(
            items,
            key=lambda x: x.get('timestamp', '1970-01-01T00:00:00'),
            reverse=True
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'notifications': sorted_items,
                'count': len(sorted_items)
            }, default=decimal_default)
        }
        
    except Exception as e:
        logger.error(f"Error getting notifications: {str(e)}")
        raise

def decimal_default(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError
