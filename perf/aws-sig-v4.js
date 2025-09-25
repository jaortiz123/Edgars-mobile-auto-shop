import crypto from 'k6/crypto';

// AWS SigV4 signing for k6
export function createSigV4Params(method, url, body, accessKeyId, secretAccessKey, sessionToken) {
  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const path = parsedUrl.pathname + parsedUrl.search;

  const now = new Date();
  const isoDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = isoDate.substr(0, 8);

  const region = 'us-west-2';
  const service = 'lambda';

  // Create canonical request
  const canonicalHeaders = `host:${host}\nx-amz-date:${isoDate}\n`;
  const signedHeaders = 'host;x-amz-date';

  let payloadHash;
  if (body) {
    payloadHash = crypto.sha256(body, 'hex');
  } else {
    payloadHash = crypto.sha256('', 'hex');
  }

  const canonicalRequest = [
    method,
    path,
    '',  // query string (already in path)
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const canonicalRequestHash = crypto.sha256(canonicalRequest, 'hex');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    isoDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');

  // Calculate signature
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.hmac('sha256', stringToSign, signingKey, 'hex');

  // Create authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    'Host': host,
    'X-Amz-Date': isoDate,
    'Authorization': authorizationHeader
  };

  if (sessionToken) {
    headers['X-Amz-Security-Token'] = sessionToken;
  }

  return { headers };
}

function getSigningKey(secretAccessKey, dateStamp, region, service) {
  const kDate = crypto.hmac('sha256', dateStamp, `AWS4${secretAccessKey}`, 'binary');
  const kRegion = crypto.hmac('sha256', region, kDate, 'binary');
  const kService = crypto.hmac('sha256', service, kRegion, 'binary');
  const kSigning = crypto.hmac('sha256', 'aws4_request', kService, 'binary');
  return kSigning;
}
