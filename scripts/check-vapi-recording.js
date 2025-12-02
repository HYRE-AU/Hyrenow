require('dotenv').config({ path: '.env.local' });

async function checkVapiCall() {
  const callId = '019addfa-d712-777e-9ee4-8ce9c6c73f67';

  console.log('Fetching Vapi call data for:', callId);
  console.log('Using API key:', process.env.VAPI_PRIVATE_KEY ? 'Found (length: ' + process.env.VAPI_PRIVATE_KEY.length + ')' : 'NOT FOUND');

  const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
    }
  });

  if (!response.ok) {
    console.error('Failed:', response.status, response.statusText);
    return;
  }

  const data = await response.json();

  console.log('\n=== VAPI CALL DATA ===');
  console.log('Status:', data.status);
  console.log('Duration:', data.duration || data.artifact?.duration || 'N/A');
  console.log('');
  console.log('=== RECORDING INFO ===');
  console.log('recordingUrl (top level):', data.recordingUrl || 'NOT FOUND');
  console.log('artifact.recordingUrl:', data.artifact?.recordingUrl || 'NOT FOUND');
  console.log('artifact.stereoRecordingUrl:', data.artifact?.stereoRecordingUrl || 'NOT FOUND');
  console.log('');
  console.log('=== ALL TOP-LEVEL KEYS ===');
  console.log(Object.keys(data).join(', '));
  console.log('');
  if (data.artifact) {
    console.log('=== ARTIFACT KEYS ===');
    console.log(Object.keys(data.artifact).join(', '));
  }
}

checkVapiCall();
