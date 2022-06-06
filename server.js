// Required modules
const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const bodyParser = require('body-parser')

// Set parameters
app.use(express.static(path.join(__dirname, '/public'))); // For css/js files etc
app.set('view engine', 'ejs'); // Set the view engine to ejs

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'thisisasecretcode', // Secret to sign cookies
  name: "secretname", // Change from default value (connect.sid) to avoid fingerprinting
  saveUninitialized: true, //
  resave: true, //
  // Cookie session hardening
  cookie: {
    httpOnly: true,
//    secure: true, // Requires HTTPS connection
    sameSite: true, // Blocks CORS requests on cookies
    maxAge: 6000000 // Time is in miliseconds
  }
}));

const sessionR = require('./src/session.js');
const dashboardR = require('./src/dashboard.js');
const usersR = require('./src/users.js');
const custodyR = require('./src/custody.js');
app.use('/', [sessionR, dashboardR, usersR, custodyR]);

const port = 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
