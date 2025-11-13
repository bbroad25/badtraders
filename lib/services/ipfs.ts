import { Buffer } from 'buffer';

async function uploadToIPFS(buffer: Buffer, contentType: string, fileName: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: contentType });
  formData.append('file', blob, fileName);

  let cid;
  const pinataJWT = process.env.PINATA_JWT;

  if (pinataJWT) {
    console.log('Using Pinata for IPFS upload...');
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
      },
      body: formData,
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata error response:', errorText);
      throw new Error(`Pinata upload failed: ${errorText}`);
    }

    const responseText = await pinataResponse.text();
    let pinataData;
    try {
      pinataData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse Pinata response as JSON: ${responseText}`);
    }
    cid = pinataData.IpfsHash;
  } else {
    const web3StorageToken = process.env.WEB3_STORAGE_TOKEN;
    if (!web3StorageToken) {
      throw new Error('Either PINATA_JWT or WEB3_STORAGE_TOKEN must be set');
    }

    console.log('Using web3.storage for IPFS upload...');
    const web3Response = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${web3StorageToken}`,
      },
      body: formData,
    });

    if (!web3Response.ok) {
      const errorText = await web3Response.text();
      throw new Error(`Web3.Storage upload failed: ${errorText}`);
    }

    const web3Data = await web3Response.json();
    cid = web3Data.cid;
  }

  return cid;
}

export { uploadToIPFS };

