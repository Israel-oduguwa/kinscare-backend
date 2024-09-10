// const { S3Client } = require('@aws-sdk/client-s3');
// const multer = require('multer');
// // const multerS3 = require('multer-s3');

// const s3Client = new S3Client({
//     region: process.env.AWS_REGION,
//     credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     },
// });

// const fileFilter = (req, file, cb) => {
//     const allowedMimeTypes = [
//         'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/tiff',
//         'application/pdf', 'text/plain',
//         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//     ];
//     if (allowedMimeTypes.includes(file.mimetype)) {
//         cb(null, true);
//     } else {
//         cb(new Error('Invalid file type. Allowed types: JPEG, PNG, GIF, SVG, TIF, PDF, TXT, DOCX, XLSX'), false);
//     }
// };

// const upload = multer({
//     storage: multerS3({
//         s3: s3Client,
//         bucket: process.env.S3_BUCKET_NAME,
//         acl: 'public-read',
//         metadata: function (req, file, cb) {
//             cb(null, { fieldName: file.fieldname });
//         },
//         key: function (req, file, cb) {
//             const fileExtension = file.originalname.split('.').pop();
//             cb(null, `${Date.now().toString()}-${file.fieldname}.${fileExtension}`);
//         },
//     }),
//     fileFilter: fileFilter,
//     limits: {
//         fileSize: 5 * 1024 * 1024, // 5MB limit for all files
//     },
// });


// let upload = multer({
//     storage: multer.memoryStorage(),
//     limits: {
//         fileSize: 5 * 1024 * 1024, // Not more than 100mb
//     },
// });

// const uploadToS3 = (file) => {
//     if (!file) {
//         return null;
//     } else {
//         return new Promise((resolve, reject) => {
//             const params = {
//                 Bucket: process.env.S3_BUCKET_NAME,
//                 // Key: file.originalname,
//                 Body: file.buffer,
//                 ACL: "public-read",
//                 ContentDisposition: "inline",
//                 metadata: function (req, file, cb) {
//                     cb(null, { fieldName: file.fieldname });
//                 },
//                 ContentType: file.mimetype,
//                 fileFilter:fileFilter,
//                 key: function (req, file, cb) {
//                     const fileExtension = file.originalname.split('.').pop();
//                     cb(null, `${Date.now().toString()}-${file.fieldname}.${fileExtension}`);
//                 },
//             };
//             s3.upload(params, (err, data) => {
//                 if (err) {
//                     reject(err);
//                 }
//                 resolve(data);
//             });
//         });
//     }
// };
// module.exports = { upload, uploadToS3 };


const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// const fs = require("fs");
const multer = require('multer');
const storage = multer.memoryStorage();


const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/tiff',
        'application/pdf', 'text/plain',
        // 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed types: JPEG, PNG, GIF, SVG, TIF, PDF, TXT, DOCX, XLSX'), false);
    }
};



const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 },
    fileFilter: fileFilter,
  });
  
const s3 = new S3Client({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    // region: process.env.AWS_REGION,
})

module.exports = {upload, s3}