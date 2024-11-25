const { Router } = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');


const router = Router();

const s3 = new S3Client({
    region: process.env.AWS_REGION, credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const upload = multer({
    limits: {
        fileSize: 5 * 1024 * 1024 // Max size 5MB for files
    },
    fileFilter(req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            if (file.size > 1 * 1024 * 1024) {
                return cb(new Error('Image size should be less than 1MB'));
            }
        } else if (file.size > 5 * 1024 * 1024) {
            return cb(new Error('File size should be less than 5MB'));
        }
        cb(null, true);
    }
});

router.post('/upload-file', upload.single('file'), async (req, res) => {

    try {
        const file = req.file;
        if (!file) {
            return res.status(400).send('No file uploaded');
        }
        const uploadParams = {
            Bucket: 'kinscare-storage',
            Key: file.originalname, // Or generate a unique name
            Body: file.buffer,
            ContentType: file.mimetype,
            // ACL: 'public-read' // This line makes the file publicly accessible
        };
        const upload = new Upload({
            client: s3,
            params: uploadParams
        });
        await upload.done();
        res.json({ message: 'File uploaded successfully', url: `https://kinscare-storage.s3.amazonaws.com/${file.originalname}` });
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router