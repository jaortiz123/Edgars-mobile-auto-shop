import json
import os

import boto3

cognito_idp_client = boto3.client("cognito-idp")

USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID")
CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID")


def lambda_handler(event, context):
    route_key = event.get("routeKey")
    http_method = event.get("requestContext", {}).get("http", {}).get("method")
    raw_path = event.get("rawPath")
    print(f"Auth Lambda invoked: route_key={route_key}, method={http_method}, path={raw_path}")

    if route_key == "POST /customers/register":
        try:
            body = json.loads(event.get("body", "{}"))
            email = body.get("email")
            password = body.get("password")
            if not email or not password:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "Email and password required."}),
                }
            resp = cognito_idp_client.sign_up(
                ClientId=CLIENT_ID,
                Username=email,
                Password=password,
                UserAttributes=[{"Name": "email", "Value": email}],
            )
            return {
                "statusCode": 200,
                "body": json.dumps({"message": "User registered. Please confirm email."}),
            }
        except cognito_idp_client.exceptions.UsernameExistsException:
            return {"statusCode": 400, "body": json.dumps({"error": "User already exists."})}
        except cognito_idp_client.exceptions.InvalidPasswordException as e:
            return {"statusCode": 400, "body": json.dumps({"error": str(e)})}
        except Exception as e:
            return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
    elif route_key == "POST /customers/login":
        try:
            body = json.loads(event.get("body", "{}"))
            email = body.get("email")
            password = body.get("password")
            if not email or not password:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "Email and password required."}),
                }
            resp = cognito_idp_client.initiate_auth(
                ClientId=CLIENT_ID,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={"USERNAME": email, "PASSWORD": password},
            )
            return {
                "statusCode": 200,
                "body": json.dumps({"tokens": resp.get("AuthenticationResult", {})}),
            }
        except cognito_idp_client.exceptions.NotAuthorizedException:
            return {"statusCode": 401, "body": json.dumps({"error": "Invalid credentials."})}
        except cognito_idp_client.exceptions.UserNotFoundException:
            return {"statusCode": 404, "body": json.dumps({"error": "User not found."})}
        except cognito_idp_client.exceptions.UserNotConfirmedException:
            return {"statusCode": 401, "body": json.dumps({"error": "User not confirmed."})}
        except Exception as e:
            return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
    else:
        return {"statusCode": 404, "body": json.dumps({"error": "Not found"})}
