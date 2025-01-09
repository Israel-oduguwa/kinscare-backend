const { Router } = require('express');
const multer = require('multer');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const router = Router();

const s3 = new S3Client({
    region: process.env.AWS_REGION, credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});
// delete the file from s3 
async function deleteFileFromS3(fileUrl) {
    try {
      // Extract bucket name and key from the URL
      const url = new URL(fileUrl);
      const bucketName = url.hostname.split('.')[0]; // Extract bucket name from URL hostname
      const fileKey = decodeURIComponent(url.pathname.substring(1)); // Remove leading '/' from the path
  
      // Create delete command
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      });
  
      // Send delete command to S3
      await s3.send(deleteCommand);
  
      console.log(`File deleted successfully from S3: ${fileUrl}`);
      return { success: true, message: 'File deleted successfully.' };
    } catch (err) {
      console.error('Error deleting file from S3:', err);
      return { success: false, message: 'Failed to delete file.', error: err };
    }
  }

  router.post('/delete-file', async (req, res) => {
    const { fileUrl } = req.body;
  
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'File URL is required.' });
    }
  
    // Call delete function
    const result = await deleteFileFromS3(fileUrl);
  
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  });
  
  module.exports = router;
  