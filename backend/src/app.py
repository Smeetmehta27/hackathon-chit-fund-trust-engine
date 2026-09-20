import json
import os
import boto3
import uuid
import time
from decimal import Decimal
from constants import RISK_WEIGHTS, RISK_BIAS
from datetime import datetime

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'HackathonAppTable')
table = dynamodb.Table(table_name)

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

def get_body(event):
    body = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        import base64
        body = base64.b64decode(body).decode('utf-8')
    return json.loads(body)

def respond(status, body):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(body, default=str)
    }

def create_group(event):
    body = get_body(event)
    group_id = str(uuid.uuid4())
    now = int(time.time())
    
    item = {
        'PK': f"GROUP#{group_id}",
        'SK': "PROFILE",
        'name': body.get('name', 'New Group'),
        'monthlyAmount': Decimal(str(body.get('monthlyAmount', 1000))),
        'memberCount': 0,
        'totalRounds': 0,
        'createdAt': now
    }
    
    table.put_item(Item=item)
    return respond(201, {'groupId': group_id, 'profile': item})

def add_member(event, group_id):
    body = get_body(event)
    member_id = str(uuid.uuid4())
    now = int(time.time())
    
    item = {
        'PK': f"GROUP#{group_id}",
        'SK': f"MEMBER#{member_id}",
        'name': body.get('name', 'Unknown'),
        'phoneUpi': body.get('phoneUpi', ''),
        'joinedAt': now
    }
    
    table.put_item(Item=item)
    
    # Update member count
    table.update_item(
        Key={'PK': f"GROUP#{group_id}", 'SK': "PROFILE"},
        UpdateExpression="ADD memberCount :inc",
        ExpressionAttributeValues={':inc': 1}
    )
    
    return respond(201, {'memberId': member_id, 'member': item})

def log_round(event, group_id, round_number):
    body = get_body(event) # Expected: array of { memberId, paid, amount, dueDate, paidDate }
    
    with table.batch_writer() as batch:
        for p in body:
            member_id = p['memberId']
            batch.put_item(Item={
                'PK': f"GROUP#{group_id}",
                'SK': f"ROUND#{round_number}#MEMBER#{member_id}",
                'paid': p.get('paid', False),
                'amount': Decimal(str(p.get('amount', 0))),
                'dueDate': p.get('dueDate', 0),
                'paidDate': p.get('paidDate', 0)
            })
            
    # Update total rounds if necessary
    table.update_item(
        Key={'PK': f"GROUP#{group_id}", 'SK': "PROFILE"},
        UpdateExpression="SET totalRounds = :r",
        ExpressionAttributeValues={':r': int(round_number)}
    )
    
    return respond(200, {'message': f'Round {round_number} logged successfully'})

def compute_risk_score(member, payments):
    # Features: % paid on time, avg days late, consistency
    if not payments:
        return 0.5 # Default middle score if no history
        
    on_time_count = 0
    total_days_late = 0
    paid_count = 0
    
    for p in payments:
        if p.get('paid'):
            paid_count += 1
            due = float(p.get('dueDate', 0))
            paid_date = float(p.get('paidDate', 0))
            days_late = max(0.0, (paid_date - due) / 86400.0)
            total_days_late += days_late
            if days_late == 0:
                on_time_count += 1
                
    pct_on_time = on_time_count / len(payments) if payments else 0
    avg_days_late = total_days_late / paid_count if paid_count else (30.0 if len(payments) > 0 else 0)
    consistency = paid_count / len(payments) if payments else 0
    
    # Dot product
    x = [pct_on_time, avg_days_late, consistency]
    z = sum(wi * xi for wi, xi in zip(RISK_WEIGHTS, x)) + RISK_BIAS
    
    import math
    score = 1.0 / (1.0 + math.exp(-max(min(z, 20), -20)))
    return round(score, 2)

def get_bedrock_explanation(member_id, score, name):
    # Check cache first
    cache_key = f"RISK_EXPLANATION#{score}"
    try:
        cache_res = table.get_item(Key={'PK': f"MEMBER#{member_id}", 'SK': cache_key})
        if 'Item' in cache_res:
            return cache_res['Item']['explanation']
    except Exception as e:
        print(f"Cache get error: {e}")
        
    # Cache miss, call Bedrock
    prompt = f"""
    You are a financial advisor explaining a risk score to a chit-fund/ROSCAS group.
    Member '{name}' has a computed risk score of {score} (0 is very high risk, 1 is very low risk/reliable).
    Explain this score in 2 short sentences. Be direct.
    """
    
    try:
        # Using Converse API (supported in recent boto3)
        res = bedrock.converse(
            modelId="meta.llama3-1-8b-instruct-v1:0",
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 150, "temperature": 0.5}
        )
        explanation = res['output']['message']['content'][0]['text'].strip()
    except Exception as e:
        print(f"Bedrock error: {e}")
        try:
            # Fallback to invoke_model for Llama 3
            payload = {
                "prompt": f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                "max_gen_len": 150,
                "temperature": 0.5
            }
            res = bedrock.invoke_model(
                modelId="meta.llama3-1-8b-instruct-v1:0",
                contentType="application/json",
                accept="application/json",
                body=json.dumps(payload)
            )
            response_body = json.loads(res['body'].read().decode('utf-8'))
            explanation = response_body.get('generation', '').strip()
        except Exception as e2:
            print(f"Fallback Bedrock error: {e2}")
            explanation = f"AI Error: Could not generate explanation for score {score}."
            
    # Save to cache
    try:
        ttl = int(time.time()) + 86400 # 24 hours TTL
        table.put_item(Item={
            'PK': f"MEMBER#{member_id}",
            'SK': cache_key,
            'explanation': explanation,
            'expiresAt': ttl
        })
    except Exception as e:
        print(f"Cache put error: {e}")
        
    return explanation

def get_dashboard(event, group_id):
    # Query all items for the group
    response = table.query(
        KeyConditionExpression="PK = :pk",
        ExpressionAttributeValues={":pk": f"GROUP#{group_id}"}
    )
    
    items = response.get('Items', [])
    
    profile = None
    members = {}
    
    for item in items:
        sk = item['SK']
        if sk == "PROFILE":
            profile = item
        elif sk.startswith("MEMBER#"):
            mid = sk.split("#")[1]
            members[mid] = {'data': item, 'payments': []}
            
    for item in items:
        sk = item['SK']
        if sk.startswith("ROUND#"):
            parts = sk.split("#")
            mid = parts[3]
            if mid in members:
                members[mid]['payments'].append(item)
                
    dashboard_members = []
    
    for mid, m in members.items():
        score = compute_risk_score(m['data'], m['payments'])
        m['data']['riskScore'] = score
        # Call bedrock
        m['data']['explanation'] = get_bedrock_explanation(mid, score, m['data']['name'])
        dashboard_members.append(m['data'])
        
    # Sort members: low risk (score closer to 1.0) first
    dashboard_members.sort(key=lambda x: x['riskScore'], reverse=True)
    
    return respond(200, {
        'profile': profile,
        'payoutOrder': dashboard_members
    })

def lambda_handler(event, context):
    try:
        http = event.get('requestContext', {}).get('http', {})
        method = http.get('method', '')
        
        # Use proxy path parameter to avoid stage prefix issues
        path = event.get('pathParameters', {}).get('proxy', '')
        
        path_parts = [p for p in path.split('/') if p]
        
        if method == 'POST' and len(path_parts) == 1 and path_parts[0] == 'groups':
            return create_group(event)
            
        if len(path_parts) >= 2 and path_parts[0] == 'groups':
            group_id = path_parts[1]
            
            if method == 'POST' and len(path_parts) == 3 and path_parts[2] == 'members':
                return add_member(event, group_id)
                
            if method == 'POST' and len(path_parts) == 4 and path_parts[2] == 'rounds':
                return log_round(event, group_id, path_parts[3])
                
            if method == 'GET' and len(path_parts) == 3 and path_parts[2] == 'dashboard':
                return get_dashboard(event, group_id)
                
        return respond(404, {'error': f'Not Found: {method} {path}'})
        
    except Exception as e:
        print(f"Error: {e}")
        return respond(500, {'error': str(e)})
