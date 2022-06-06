const express = require('express');
const formidable = require('formidable');
const bcrypt = require('bcryptjs');
const ac = require('./services/accessControl.js');
const db = require('./services/database.js');
const fileStore = require('./services/fileStore.js');
const mailer = require('./services/mailer.js');
const router = express.Router();

function generatePassword() {
    var length = 8,
        charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~!@-#$",
        retVal = "";
    for (var i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}

function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function validateUsername(username){
  return username.split('.').pop();
}

function getFileExtension(filename)
{
  var ext = /^.+\.([^.]+)$/.exec(filename);
  return ext == null ? "" : ext[1];
}

module.exports = {
  sendMail: function () {
      let mailTransporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
              user:"itpteam14@gmail.com",
              pass: "Toor1234qwer",
          },
      });
  },
};


router.get('/userList', ac.isLoggedIn, ac.grantAccess('admin'), function (req, res) {
  res.render('pages/userList',{
    name: req.session.name,
    user_role: req.session.role
  });
});

router.get('/addUser', ac.isLoggedIn, ac.grantAccess('admin'), function (req, res) {
  res.render('pages/addUser',{
    name: req.session.name,
    user_role: req.session.role,
  });
});

router.post('/addUser', ac.isLoggedIn, ac.grantAccess('admin'), function (req, res) {
  var username = req.body.username;
  var email = req.body.email;
  var role = req.body.role;
  var userpass = generatePassword()
  var password = bcrypt.hashSync(userpass, 10);
  var count = 0;
  var error = '';

  if (!(validateUsername(username)))
  {
    count = 1;
    error += "Only Alphanumeric Characters are allowed.";
  }

  if (!(validateEmail(email)))
  {
    count = 1;
    error += "Email not in proper format.";
  }

  db.getEmail(email).then((results) => {
    if(results.length > 0) 
    {
      count = 1;
      error += " Email already exists.";
    }

    if (count === 0 )
    {
      db.addUser(username,password,role,email)
      try {
        mailer.sendEmail(email,userpass,2)
      } catch(err) {
        res.json("Something went wrong!");
        console.log(`Nodemailer Failed: ${err}`);
        return;
      }
      error = 0;
      res.render('pages/addUser',{
        name: req.session.name,
        user_role: req.session.role,
        error: error,
        userpass: userpass
      });
    }
  
    else
    {
      res.render('pages/addUser',{
        name: req.session.name,
        user_role: req.session.role,
        error: error
      });
    }
  });

});


router.get('/addUserCSV', ac.isLoggedIn, ac.grantAccess('admin'), function (req, res) {
  res.render('pages/addUserCSV',{
    name: req.session.name,
    user_role: req.session.role
  });
});

router.post('/addUserCSV', ac.isLoggedIn, ac.grantAccess('admin'), function (req, res) {
  const form = formidable(fileStore.formidableSettings);
  form.parse(req, (err, fields, files) => {
    console.log('test')
   if (err) {
     next(err);
     return;
   }

  let file = files.uploadFile.path;


  db.addUsersViaCsv(file).then((results) => {
      res.render('pages/addUserCSV',{
        name: req.session.name,
        user_role: req.session.role,
        results: results,
        error: 0
      });
      })
      .catch(err => {
        console.error(`Nodemailer Failed: ${err}`);
        res.render('pages/addUserCSV',{
          name: req.session.name,
          user_role: req.session.role,
          results: undefined,
          error: err
        });
      })
  });
});

router.get('/changeUserRole', ac.isLoggedIn, ac.grantAccess('admin'), function (req, res) {
  db.getUL().then((results) => {
  var ulResults = results
  res.render('pages/changeUserRole',{
    name: req.session.name,
    user_role: req.session.role,
    ulResults: ulResults
    });
  });
});

router.post('/changeUserRole', ac.isLoggedIn, ac.grantAccess('admin'), function (req, res) {
  var username = req.body.username;
  var role = req.body.role;
  var success = 0;
  db.changeRole(username,role)
  db.getUL().then((results) => {
    var ulResults = results
    res.render('pages/changeUserRole',{
      name: req.session.name,
      user_role: req.session.role,
      ulResults: ulResults,
      success: success
      });
    });
});

router.get('/changePassword', ac.isLoggedIn, function (req, res) {
  res.render('pages/changePassword',{
    name: req.session.name,
    user_role: req.session.role,
  });
});

router.post('/changePassword', ac.isLoggedIn, function (req, res) {
  var oldpass = req.body.oldpass
  var newpass = bcrypt.hashSync(req.body.newpass, 10);

  db.getEmail(req.session.email).then((results) => {
    if (bcrypt.compareSync(oldpass, results[0].password)) {
      db.updatePassword(req.session.email,newpass)
      var error = 0
      req.session.firstlogin = 1
      res.render('pages/changePassword',{
        name: req.session.name,
        user_role: req.session.role,
        error: error
      });
    }

    else
    {
      var error = 1;
      res.render('pages/changePassword',{
        name: req.session.name,
        user_role: req.session.role,
        error: error
      });
    }
  });
});

// Remove User
router.get('/removeUser', ac.isLoggedIn, ac.grantAccess('admin'), function (req, res) {
  var id = req.query.id;
  db.removeUser(id);
  res.redirect('/dashboard');
});

  
module.exports = router;
