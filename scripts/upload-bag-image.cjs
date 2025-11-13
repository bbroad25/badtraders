const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();

async function uploadBagImage() {
  const imagePath = path.join(__dirname, '../public/badbag.png');

  if (!fs.existsSync(imagePath)) {
    console.error('❌ Image not found at:', imagePath);
    process.exit(1);
  }

  const pinataJWT = process.env.PINATA_JWT;
  if (!pinataJWT) {
    throw new Error('PINATA_JWT must be set in .env');
  }

  console.log('📤 Uploading to Pinata...');
  const formData = new FormData();
  formData.append('file', fs.createReadStream(imagePath));

  const response = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    formData,
    {
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
        ...formData.getHeaders(),
      },
    }
  );

  const cid = response.data.IpfsHash;
  console.log('✅ Uploaded to Pinata');

  const ipfsUrl = `ipfs://${cid}`;
  const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;

  console.log('\n✅ Bag Image uploaded successfully!');
  console.log('📋 IPFS Details:');
  console.log('  CID:', cid);
  console.log('  IPFS URL:', ipfsUrl);
  console.log('  Gateway URL:', gatewayUrl);
  console.log('\n💡 Use this SAME IPFS URL for ALL Bag NFTs');
  console.log('   The contract will generate metadata on-the-fly with token ID');

  // Save to file
  const output = {
    cid,
    ipfsUrl,
    gatewayUrl,
    uploadedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, '../bag-image-ipfs.json'),
    JSON.stringify(output, null, 2)
  );

  console.log('\n📝 Saved to bag-image-ipfs.json');
}

uploadBagImage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });

