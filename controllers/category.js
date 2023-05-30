const Category = require('../models/category');
const slugify = require('slugify');
const formidable = require('formidable');
const AWS = require('aws-sdk');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

exports.create = (req, res) => {
    let form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(400).json({
                error: "Image could not upload"
            })
        }
        const { name, content } = fields;
        const { image } = files;
        //console.table(image);

        const slug = slugify(name);
        let category = new Category({ name, content, slug });
        if (image.size > 2000000) {
            return res.status(400).json({
                error: "Image should be less than 2mb"
            })
        }
        console.log('create', image.filepath);
        const params = {
            Bucket: 'hackerio-img',
            Key: `category/${uuidv4()}`,
            Body: fs.readFileSync(image.filepath),
            ACL: 'public-read',
            ContentType: 'image/jpg'
        };

        s3.upload(params, (err, data) => {
            if (err) {
                console.log(err);
                res.status(400).json({ error: 'Upload to s3 failed' });
            }
            console.log('AWS UPLOAD RES DATA', data);
            category.image.url = data.Location;
            category.image.key = data.Key;
            // posted by
            category.postedBy = req.user._id;

            // save to db
            category.save((err, success) => {
                if (err) {
                    console.log(err);
                    res.status(400).json({ error: 'Duplicate category' });
                }
                return res.json(success);
            });
        });

    })

};

// exports.create = (req, res) => {
//     const { name, content } = req.body;
//     const slug = slugify(name);
//     const image = {
//         url: `https://via.placeholder.com/200x150.png?text=${process.env.CLIENT_URL}`,
//         key: '123'
//     };

//     const category = new Category({ name, slug, image });
//     category.postedBy = req.user._id;

//     category.save((err, data) => {
//         if (err) {
//             console.log('CATEGORY CREATE ERR', err);
//             return res.status(400).json({
//                 error: 'Category create failed'
//             });
//         }
//         res.json(data);
//     });
// };

exports.list = (req, res) => {
    Category.find({}).exec((err, data) => {
        if (err) {
            return res.status(400).json({
                error: 'Categories could not load'
            });
        }
        res.json(data);
    });
};

exports.read = (req, res) => {
    //
};

exports.update = (req, res) => {
    //
};

exports.remove = (req, res) => {
    //
};