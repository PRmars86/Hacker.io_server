const AWS = require('aws-sdk')

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_ID,
    region: process.env.AWS_REGION,
});

const ses = new AWS.SES({ apiVersion: '2010-12-01' });


exports.register = (req, res) => {
    //console.log("Controller", req.body)
    const { name, email, password } = req.body
    const params = {
        Source: process.env.EMAIL_FROM,
        Destination: {
            ToAddresses: [email]
        },
        ReplyToAddresses: [process.env.EMAIL_TO],
        Message: {
            Body: {
                Html: {
                    Charset: 'UTF_8',
                    Data: `<html><body><h1> Hello ${name}</h1 style="colore:red;"><p>Test email</p></body></html>`
                }
            },
            Subject: {
                Charset: 'UTF_8',
                Data: "Compelete your registeration"
            }
        }
    }

    const sendEmailOnRegister = ses.sendEmail(params).promise();

    sendEmailOnRegister
        .then(data => {
            console.log('email submitted to SES', data)
            res.send("Email sent")
        })
        .catch(error => {
            console.log('ses email on register', error)
            res.send("Email failed")
        })
}