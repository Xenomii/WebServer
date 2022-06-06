const e = require('express');
const nodemailer = require('nodemailer');
const config = require("./config.js");

exports.sendEmail = function(email, pass, option){
    let transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 1,
        host: config.get().Mailer.host, // hostname
        secureConnection: false, // TLS requires secureConnection to be false
        port: 587, // port for secure SMTP
        tls: {
        ciphers:'SSLv3'
        },
        auth: {
            user: config.get().Mailer.user,
            pass: config.get().Mailer.pass
        }});
    
        if (option === 1)
        {
            for (var i = 0; i < email.length; i++){

                let mailOptions = {
                    from: config.get().Mailer.user,
                    to: email[i],
                    subject: `Evidence Management System Password`,
                    html: `Your user password is ` + pass[i],
                    };
                    
                    transporter.sendMail(mailOptions, function (err, info) {
                        if (err) throw new Error(err);
                        console.log(`Email sent successfully to: ${info.envelope.to}`);
                    });
            }
        }

        else
        {
            let mailOptions = {
                from: config.get().Mailer.user,
                to: email,
                subject: `Evidence Management System Password`,
                html: `Your user password is ` + pass,
                };
                
                transporter.sendMail(mailOptions, function (err, info) {
                    if (err) throw new Error(err);
                    console.log(`Email sent successfully to: ${info.envelope.to}`);
                });
        }
}


