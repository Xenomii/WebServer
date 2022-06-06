const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');
const csvtojson = require('csvtojson');
const bcrypt = require('bcryptjs');
const mailer = require('./mailer.js');
const config = require("./config.js");

const con = mysql.createConnection({
  host: config.get().UserDatabase.host,
  user: config.get().UserDatabase.user,
  password: config.get().UserDatabase.pass,
  database: config.get().UserDatabase.database
});

con.connect((err) => {
  if (err) return console.error('error: ' + err.message);
  console.log("Users Database Connection OK");
});

function generatePassword() {
  var length = 8,
      charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~!@-#$",
      retVal = "";
  for (var i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

exports.getUsers = function() {
  const statement = 'SELECT * FROM Credentials';
  return new Promise((res, rej) => con.execute(statement, [], (err, results) => {
     try {
       if (err) throw err;
       res(JSON.parse(JSON.stringify(results)));
     } catch(err) {
       rej(err);
     }
  }));
}

exports.getUL = function() {
  const statement = "SELECT * FROM Credentials WHERE (role = 'manager' or role = 'investigator') and deleted = '0'";
  return new Promise((res, rej) => con.execute(statement, [], (err, results) => {
     try {
       if (err) throw err;
       res(JSON.parse(JSON.stringify(results)));
     } catch(err) {
       rej(err);
     }
  }));
}

exports.getUser = function(_email) {
  const statement = 'SELECT * FROM Credentials WHERE email = ?';
  return new Promise((res, rej) => {
    con.execute(statement, [`${_email}`], (err, results) => {
      try {
        if (err) throw err;
        formattedResult = JSON.parse(JSON.stringify(results));
        if (formattedResult.length === 0) throw new Error("No Result From Database");
        res(formattedResult);
      } catch(err) {
        rej(err);
      }
    });
  });
}

exports.getEmail = function(_email) {
  const statement = 'SELECT * FROM Credentials WHERE email = ?';
  return new Promise((res, rej) => con.execute(statement, [`${_email}`], (err, results) => {
     try {
       if (err) throw err;
       res(JSON.parse(JSON.stringify(results)));
     } catch(err) {
       rej(err);
     }
  }));
}

exports.addUser = function(_user, _password, _role, _email) {
  const statement = 'INSERT INTO Credentials(id, username, password, role, email) VALUES (?,?,?,?,?)';
  con.query(statement, [`${uuidv4()}`,`${_user}`,`${_password}`,`${_role}`,`${_email}`], (err, results) => {
    try {
      if (err) throw err;
      console.log("User Successfully Added");
    } catch(err) {
      rej(err);
    }
  });
}

exports.addUsersViaCsv = function(_filePath) {
var userinfo = new Array()
  return new Promise((res, rej) => {   
    csvtojson().fromFile(_filePath).then(source => {
      // Fetching the data from each row and inserting to the table "Credentials"
      var role = source.filter(role => (role.role != "admin" && role.role != "manager" && role.role != "investigator"))
      
      if(role.length > 0){
        rej("Role enterred is invalid")
      }

      else{
        var jsons = source.map(email => email.email)
        let tempString = con.escape(jsons);
        var statement = 'SELECT * FROM Credentials WHERE email IN ('+tempString+')';
        const mailList = []
        const passList = []
        con.execute(statement, [], (err, results) => {
          if (results.length > 0)
          {
            rej("Email already exists")
          }

          else
          {
            for (var i = 0; i < source.length; i++) {                
                var role = source[i]["role"]
                var email = source[i]["email"]
                var username = source[i]["username"]
                var pass = generatePassword()
                var Password = bcrypt.hashSync(pass, 10)
                var insertStatement = `INSERT INTO Credentials(id,username,password,role,email) values(?, ?, ?, ?, ?)`;
                var items = [`${uuidv4()}`, username, Password, role, email];

                mailList.push(email)
                passList.push(pass)
                source[i]["password"] = pass

                userinfo.push(source[i])
                // Inserting data of current row into database
                con.query(insertStatement, items, (err, results, fields) => {
                  if (err) {
                    console.log("Unable to insert item at row ", i + 1);
                    return console.log(err);
                  }
                });
            }
            try {
              mailer.sendEmail(mailList,passList,1)
            } catch(err) {
              rej(err);
              return;
            }
            res(userinfo)
          }
        });
      }
  });
});
}

exports.changeRole = function(_user, _role) {
  const statement = 'UPDATE Credentials SET role = ? WHERE username = ?';
  con.query(statement, [`${_role}`,`${_user}`], (err, results) => {
    try {
      if (err) throw err;
        console.log("User Role Successfully Updated");
    } catch(err) {
      rej(err);
    }
  });
}

exports.updatePassword = function(_user, _pass) {
  const statement = 'UPDATE Credentials SET password = ?, firstlogin = 1 WHERE email = ?';
  con.query(statement, [`${_pass}`,`${_user}`], (err, results) => {
    try {
      if (err) throw err;
        console.log("Password Successfully Updated");
    } catch(err) {
      rej(err);
    }
  });
}


exports.getUUID = function(_user) {
  const statement = 'SELECT * FROM Credentials WHERE username = ?';
  return new Promise((res, rej) => con.execute(statement, [`${_user}`], (err, results) => {
    try {
      if (err) throw err;
      res(JSON.parse(JSON.stringify(results)));
    } catch(err) {
      rej(err);
    }
  }));
}

exports.getCaseOfficerDetails = function(_officerList, _checkDeleted) {
  let tempString = con.escape(_officerList);
  var statement;
  if (_checkDeleted === 1)
    statement = 'SELECT * FROM Credentials WHERE id IN ('+tempString+') and deleted = 0';
  else
    statement = 'SELECT * FROM Credentials WHERE id IN ('+tempString+')';
  return new Promise((res, rej) => con.execute(statement, [], (err, results) => {
    try {
      if (err) throw err;
      res(JSON.parse(JSON.stringify(results)));
    } catch(err) {
      rej(err);
    }
  }));
}


exports.removeUser = function(_user) {
  const statement = 'UPDATE Credentials SET deleted = 1 WHERE id = ?';
  return new Promise((res, rej) => con.execute(statement, [`${_user}`], (err, results) => {
    try {
      if (err) throw err;
      res(JSON.parse(JSON.stringify(results)));
    } catch(err) {
      rej(err);
    }
  }));
}
