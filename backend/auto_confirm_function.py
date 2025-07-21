def lambda_handler(event, context):
    # Auto-confirm and auto-verify user for dev environment pre-sign-up trigger
    event.setdefault('response', {})
    event['response']['autoConfirmUser'] = True
    event['response']['autoVerifyEmail'] = True
    return event
