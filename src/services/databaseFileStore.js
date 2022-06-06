const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');
const config = require("./config.js");

const con = mysql.createConnection({
  host: config.get().FileDatabase.host,
  user: config.get().FileDatabase.user,
  password: config.get().FileDatabase.pass,
  database: config.get().FileDatabase.database
});

con.connect((err) => {
  if (err) return console.error('error: ' + err.message);
  console.log("Filestore Database Connection OK");
});

// Put on hold after blockchain integration is done
exports.addEvidence = function(_id, _path, _timestamp, _hash) {
  return new Promise((res, rej) => con.execute('SELECT * FROM Storage_Path WHERE id = ?', [`${_id}`], (err, results) => {
    let datetime = new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ');
    con.execute('INSERT INTO Storage_Path(id, path, timestamp, hash) VALUES (?,?,?,?)', [`${_id}`, `${_path}`, `${datetime}`, `${_hash}`], (err, results) => {
      try {
        if (err) throw err;
        res(true);
      } catch(err) {
        rej(err);
      }
    });
  }));
}

exports.getEvidence = function(_id) {
  return new Promise((res, rej) => con.execute('SELECT * FROM Storage_Path WHERE id = ?', [`${_id}`], (err, results) => {
    try {
      if (err) throw err;
      var results = JSON.parse(JSON.stringify(results));
      res(results[results.length - 1]);
    } catch(err) {
      rej(err);
    }
  }));
}

exports.getEvidencePath = function(_evidenceUuid) {
  let tempString = con.escape(_evidenceUuid);
  // const statement = 'SELECT path, MAX(num) FROM Storage_Path WHERE id IN ('+tempString+') GROUP BY path';
  const statement = 'SELECT id, path FROM Storage_Path WHERE id IN ('+tempString+')';
  return new Promise((res, rej) => con.execute(statement, [], (err, results) => {
    try {
      if (err) throw err;
      res(JSON.parse(JSON.stringify(results)));
    } catch(err) {
      rej(err);
    }
  }));
}
