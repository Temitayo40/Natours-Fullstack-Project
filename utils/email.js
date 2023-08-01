const nodemailer = require('nodemailer');

const sendEmail = async options => {
  //1) create a transporter: basically a service that will send the email.
  const transpoter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    }
  });
  //ACTIVATE in gmail "less secure app" option
  //2) DEfine the email options
  const mailOptions = {
    from: 'Damilola Adebowale <dharmmycrown40@gmail.com>',
    to: options.email,
    subject: options.subject,
    text: options.message
    // html:
  };

  //3)Actually send the email
  await transpoter.sendMail(mailOptions);
};

module.exports = sendEmail;
