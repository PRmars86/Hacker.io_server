const User = require('../models/user');
const Link = require('../models/link');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { registerEmailParams, forgotPasswordEmailParams } = require('../helpers/email');
const shortid = require('shortid');
const expressJwt = require('express-jwt');
const user = require('../models/user');
const _ = require('lodash');

AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: 'default' });
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});



const ses = new AWS.SES({ apiVersion: '2010-12-01' });

exports.register = (req, res) => {
    // console.log('REGISTER CONTROLLER', req.body);
    const { name, email, password, categories } = req.body;
    // check if user exists in our db
    User.findOne({ email }).exec((err, user) => {
        if (user) {
            return res.status(400).json({
                error: 'Email is taken'
            });
        }
        // generate token with user name email and password
        const token = jwt.sign({ name, email, password, categories }, process.env.JWT_ACCOUNT_ACTIVATION, {
            expiresIn: '10m'
        });

        // send email
        const params = registerEmailParams(email, token);

        const sendEmailOnRegister = ses.sendEmail(params).promise();

        sendEmailOnRegister
            .then(data => {
                console.log('email submitted to SES', data);
                res.json({
                    message: `Email has been sent to ${email}, follow the instructions to complete your registration`
                })
            })
            .catch(error => {
                console.log('ses email on register', error);
                res.json({
                    message: `We could not verify your email, please try again`
                })
            });
    });
};

exports.registerActivate = (req, res) => {
    const { token } = req.body;
    //console.log(token);

    jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function (err, decoded) {
        if (err) {
            return res.status(401).json({
                error: 'Expired link. Try again'
            })
        }

        const { name, email, password, categories } = jwt.decode(token);
        const username = shortid.generate();

        User.findOne({ email }).exec((err, user) => {
            if (user) {
                return res.status(401).json({
                    error: 'Email is taken'
                })
            }

            //create new user
            const newUser = new User({ username, name, email, password, categories });
            newUser.save((err, result) => {
                if (err) {
                    return res.status(401).json({
                        error: 'Error saving user in database, Try later'
                    })
                }
                return res.json({
                    message: 'Registration success. Please login'
                })
            })
        })

    });
};

exports.login = (req, res) => {
    const { email, password } = req.body;
    ///console.table({ email, password });
    User.findOne({ email }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                message: 'User with that email does not exist, Please register.'
            })
        }

        if (!user.authenticate(password)) {
            return res.status(400).json({
                message: 'Email and password do not match.'
            })
        }

        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const { _id, name, email, role } = user;

        return res.json({
            token, user: { _id, name, email, role }
        })
    })
};


exports.requireSignin = expressJwt({ secret: process.env.JWT_SECRET }); // req.user

exports.authMiddleware = (req, res, next) => {
    const authUserId = req.user._id;
    User.findOne({ _id: authUserId }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User not found'
            });
        }
        req.profile = user;
        next();
    });
};

exports.adminMiddleware = (req, res, next) => {
    const adminUserId = req.user._id;
    User.findOne({ _id: adminUserId }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User not found'
            });
        }

        if (user.role !== 'admin') {
            return res.status(400).json({
                error: 'Admin resource. Access denied'
            });
        }

        req.profile = user;
        next();
    });
};

exports.forgotPassword = (req, res) => {
    const { email } = req.body;

    User.findOne({ email }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User with that email does not exist'
            });
        }

        const token = jwt.sign({ name: user.name }, process.env.JWT_RESET_PASSWORD, { expiresIn: '10m' });

        const params = forgotPasswordEmailParams(email, token);

        // populate the db > user > reset
        return user.updateOne({ resetPasswordLink: token }, (err, success) => {
            if (err) {
                return res.status(400).json({
                    error: 'Password reset failed'
                });
            }

            const sendEmail = ses.sendEmail(params).promise();

            sendEmail
                .then(data => {
                    console.log('ses reset password success', data);
                    return res.json({
                        message: `Email has been sent to ${email}. Click on the link to reset your password`
                    })
                })
                .catch(error => {
                    console.log('ses reset password failed', error)
                    return res.json({
                        message: `We could not verify your email, try later`
                    })
                })
        })
    });
};

exports.resetPassword = (req, res) => {
    const { resetPasswordLink, newPassword } = req.body;
    if (resetPasswordLink) {
        // check for expiry
        jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, (err, success) => {
            if (err) {
                return res.status(400).json({
                    error: 'Expired Link. Try again.'
                });
            }

            User.findOne({ resetPasswordLink }).exec((err, user) => {
                if (err || !user) {
                    return res.status(400).json({
                        error: 'Invalid token. Try again'
                    });
                }

                const updatedFields = {
                    password: newPassword,
                    resetPasswordLink: ''
                };

                user = _.extend(user, updatedFields);

                user.save((err, result) => {
                    if (err) {
                        return res.status(400).json({
                            error: 'Password reset failed. Try again'
                        });
                    }

                    res.json({
                        message: `Great! Now you can login with your new password`
                    });
                });
            });
        });
    }
};

exports.canUpdateDeleteLink = (req, res, next) => {
    const { id } = req.params;
    Link.findOne({ _id: id }).exec((err, data) => {
        if (err) {
            return res.status(400).json({
                error: 'Could not find link'
            });
        }
        let authorizedUser = data.postedBy._id.toString() === req.user._id.toString();
        if (!authorizedUser) {
            return res.status(400).json({
                error: 'You are not authorized'
            });
        }
        next();
    });
};
