const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./services/database.js');

const router = express.Router();

// initialize modules/parameters
const salt = bcrypt.genSaltSync(10);

router.route('/')
  .get(function (req, res) {
    res.render('pages/index', {
      mascots: [],
      tagline: ""
    })
  })
  .post(function (req, res) {
    let {email, pass} = req.body;
    db.getUser(email).then((results) => {
      if (results[0].active) {
        console.log("error here")
        res.render('pages/index',{
          error: 1
        });
        return;
      }
      if (bcrypt.compareSync(pass, results[0].password)) {
        req.session.login = true;
        req.session.uuid = results[0].id;
        req.session.name = results[0].username;
        req.session.email = results[0].email;
        req.session.role = results[0].role;
        req.session.firstlogin = results[0].firstlogin;
        res.redirect('/dashboard');
        console.log(`${req.session.uuid} Login SUCCESSFUL`);
      }
      else {
        res.redirect('/');
      }
    }).catch(err => console.log(err));
  });

router.get('/logout', function (req, res) {
  let uuid = req.session.uuid;
  req.session.regenerate(function(err) {
    try {
      if (err) throw err;
      res.redirect('/');
      console.log(`${uuid} logout SUCCESSFUL`);
    } catch(err) {
      console.log(`Logout Error: ${err}`);
    }
  })
});

module.exports = router;
//    db.addUser("Timmy",bcrypt.hashSync("Timmy", salt), 3)

