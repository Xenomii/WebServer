const express = require('express');
const { v4: uuidv4 } = require('uuid');
const formidable = require('formidable');
const fs = require('fs');
const ac = require('./services/accessControl.js');
const db = require('./services/database.js');
const dbfs = require('./services/databaseFileStore.js');
const burrow = require('./services/burrow.js');
const fileStore = require('./services/fileStore.js');
const { promiseImpl } = require('ejs');
const { exec } = require('child_process');
var Docker = require('dockerode');
const { stream } = require('@hyperledger/burrow/dist/events.js');

const router = express.Router();

// Case Information Page
router.get('/caseInfo', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  delete req.session.currentEvidenceList;
  delete req.session.currentEvidencePaths;

  try {
    if (isNaN(Number(req.query.caseId))) throw new Error("Invalid Case Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var caseName = Object.values(req.session.relevantCase)[req.query.caseId];
    if (!caseUuid || !caseName) throw new Error("Invalid Case UUID or Name");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  Promise.all([
    burrow.contract.GetCaseClosed(caseUuid),
    burrow.contract.GetCaseInfo(caseUuid)
  ]).then(ret => {
    db.getCaseOfficerDetails(ret[1].uuid, 0).then(officerList => {
      var evidences = burrow.formatToArray(ret[1].latestEvidences);
      req.session.currentEvidenceList = {};
      for (var i = 0; i < evidences.length; i++) {
        req.session.currentEvidenceList[evidences[i][0]] = evidences[i][1];
      }
      if (Object.keys(req.session.currentEvidenceList).length === 0) {
        res.render('pages/caseInfo', {
          name: req.session.name,
          user_role: req.session.role,
          caseuuid: caseUuid,
          casename: caseName,
          evidenceList: evidences,
          caseDetails: ret[1].caseDetails,
          officerList: officerList,
          closed: ret[0].caseClosed,
          caseid: req.query.caseId
        });
      } else {
        let evidenceUUIDList = Object.keys(req.session.currentEvidenceList);
        dbfs.getEvidencePath(evidenceUUIDList).then(evidencePaths => {
          req.session.currentEvidencePaths = []
          for (let i = 0; i < evidenceUUIDList.length; i++) {
            for (let j = evidencePaths.length - 1; j >= 0; j--) {
              if (evidenceUUIDList[i] === evidencePaths[j].id) {
                req.session.currentEvidencePaths.push(evidencePaths[j].path);
                break;
              }
            }
          }

          db.getCaseOfficerDetails(ret[1].uuid, 0).then(officerList => {
            res.render('pages/caseInfo', {
              name: req.session.name,
              user_role: req.session.role,
              caseuuid: caseUuid,
              casename: caseName,
              evidenceList: evidences,
              caseDetails: ret[1].caseDetails,
              officerList: officerList,
              closed: ret[0].caseClosed,
              caseid: req.query.caseId
            });
          });
        });
      }
    });
  })
});


// Download Evidence
router.get('/download', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.pathId)) || isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    var filePath = req.session.currentEvidencePaths[req.query.pathId];
    if (!caseUuid || !evidenceUuid || !filePath) throw new Error("Invalid Case/Evidence UUID or File Path");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  burrow.contract.GetLatestCaseEvidence(caseUuid, evidenceUuid).then(ret => {
    var latestEvidence = ret.retEvidence.split('|');
    latestEvidence.unshift(caseUuid);
    latestEvidence[3] = new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ');
    latestEvidence[4] = "Download Evidence";
    latestEvidence[5] = req.ip.slice(7);
    latestEvidence[7] = '-';
    latestEvidence[10] = req.session.uuid;

    burrow.contract.LogEvidence(latestEvidence).then(() => {
      res.download(filePath);
    });


  }).catch(err => res.send(handlerError(err)))
});


// [GET] Add Case Page
router.get('/addCase', ac.isLoggedIn, ac.grantAccess('manager'), function (req, res) {
  db.getUL().then((results) => {
    var ulResults = results.filter(function (obj) {
      return obj.id !== req.session.uuid;
    });

    res.render('pages/addCase', {
      name: req.session.name,
      user_role: req.session.role,
      ulResults: ulResults
    });
  });
});



// [POST] Add Case Page
router.post('/addCase', ac.isLoggedIn, ac.grantAccess('manager'), function (req, res) {
  try {
    var uuid = uuidv4();
    var casename = req.body.casename;
    var casedetails = req.body.casedetails;
    var officerlist = new Array(req.session.uuid);
    if (!uuid || !casename || !casedetails) throw new Error("Invalid User Inputs");
    if (Array.isArray(req.body.officerlist)) officerlist.push(...req.body.officerlist);
    else if (req.body.officerlist) officerlist.push(req.body.officerlist);
    burrow.contract.AddCase(uuid, casename, officerlist, casedetails).then().catch(err => console.error(err));
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(400).json("Invalid Input");
  }
});



// [GET] Update Case Page
router.get('/updateCase', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId))) throw new Error("Invalid Case Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var caseName = Object.values(req.session.relevantCase)[req.query.caseId];
    if (!caseUuid || !caseName) throw new Error("Invalid Case UUID or Name");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  burrow.contract.GetCaseDetails(caseUuid).then(cd => {
    burrow.contract.GetCaseOfficers(caseUuid).then(ret => {
      db.getUL().then((results) => {
        var ulResults = results
        ulResults = ulResults.filter(user => { return ret.allCaseOfficers.indexOf(user.id) < 0; })
        res.render('pages/updateCase', {
          name: req.session.name,
          user_role: req.session.role,
          ulResults: ulResults,
          caseuuid: caseUuid,
          casename: caseName,
          caseid: req.query.caseId,
          casedetails: cd.caseDetails
        });
      });
    });
  });
});

// [POST] Update Case Page
router.post('/updateCase', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId))) throw new Error("Invalid Case Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    if (!caseUuid) throw new Error("Invalid Case UUID");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  try {
    var casedetails = req.body.casedetails;
    if (!casedetails) throw new Error("Invalid Case Details Input");
    var officerlist = new Array();
    if (Array.isArray(req.body.officerlist)) officerlist.push(...req.body.officerlist);
    else if (req.body.officerlist) officerlist.push(req.body.officerlist);

    burrow.contract.EditCaseDetails(caseUuid, casedetails).then(() => {
      if (officerlist.length > 0)
        burrow.contract.AddUUIDToCase(caseUuid, officerlist).then(() => { res.redirect('/dashboard'); });
      else
        res.redirect('/dashboard');
    });
  } catch (err) {
    console.error(err);
    res.status(400).json("Invalid Input");
  }
});



// View Evidence List Page
router.get('/evidenceList', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Case/Evidence Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var caseName = Object.values(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    if (!caseUuid || !caseName || !evidenceUuid) throw new Error("Invalid Case/Evidence UUID or Case Name");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  burrow.contract.GetAllSimilarEvidence(caseUuid, evidenceUuid).then(ret => {
    var evidenceList = burrow.formatToArray(ret.retEvidence)
    // Remove empty
    let i = evidenceList.length - 1;
    while (true) {
      if (!evidenceList[i][0]) evidenceList.pop();
      else break;
      i--;
    }

    let uniqueOfficer = [];
    for (let i = 0; i < evidenceList.length; i++) {
      if (uniqueOfficer.indexOf(evidenceList[i][7]) === -1) uniqueOfficer.push(evidenceList[i][7]);
      if (uniqueOfficer.indexOf(evidenceList[i][9]) === -1) uniqueOfficer.push(evidenceList[i][9]);
    }

    db.getCaseOfficerDetails(uniqueOfficer, 0).then(officerList => {
      for (let i = 0; i < evidenceList.length; i++) {
        evidenceList[i][7] = officerList.find(({ id }) => id == evidenceList[i][7]).username + ": " + evidenceList[i][7];
        evidenceList[i][9] = officerList.find(({ id }) => id == evidenceList[i][9]).username + ": " + evidenceList[i][9];
      }

      res.render('pages/evidenceList', {
        user_role: req.session.role,
        name: req.session.name,
        caseid: req.query.caseId,
        casename: caseName,
        caseuuid: caseUuid,
        evidenceid: req.query.evidenceId,
        evidenceuuid: evidenceUuid,
        evidence: evidenceList,
        hashresult: undefined
      });
    });
  });
});


// Verify Hash
router.post('/evidenceList', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Case/Evidence Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var caseName = Object.values(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    if (!caseUuid || !caseName || !evidenceUuid) throw new Error("Invalid Case/Evidence UUID or Case Name");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  try {
    const form = formidable(fileStore.formidableSettings);

    form.parse(req, (err, fields, files) => {
      if (err) throw new Error("Form Parse Failed");

      console.log(files.uploadFile.hash);
      fs.unlink(files.uploadFile.path, (err) => {
        if (err) throw new Error("Remove File Failed");
        console.log("File for hash verification removed: ", files.uploadFile.path);
      })

      burrow.contract.GetAllSimilarEvidence(caseUuid, evidenceUuid).then(ret => {
        var evidenceList = burrow.formatToArray(ret.retEvidence)
        // Remove empty
        let i = evidenceList.length - 1;
        while (true) {
          if (!evidenceList[i][0]) evidenceList.pop();
          else break;
          i--;
        }

        let uniqueOfficer = [];
        let hashResult = { found: 0, num: -1, msg: "Evidence not found in CoC Blockchain." };
        let numEvidence = 0;
        for (let i = 0; i < evidenceList.length; i++) {
          if (uniqueOfficer.indexOf(evidenceList[i][7]) === -1) uniqueOfficer.push(evidenceList[i][7]);
          if (uniqueOfficer.indexOf(evidenceList[i][9]) === -1) uniqueOfficer.push(evidenceList[i][9]);
          if (evidenceList[i][3] === "Added to Blockchain" || evidenceList[i][3] === "Update Evidence") {
            numEvidence++;
            if (evidenceList[i][4] === files.uploadFile.hash)
              hashResult = {
                found: 2, num: numEvidence, msg: "Evidence found ",
                info: `<br>Timestamp: ${evidenceList[i][2]}<br>Unique Hash: ${evidenceList[i][4]}`
              }
          }
        }

        if (hashResult.num === numEvidence) {
          hashResult.found = 1;
          hashResult.msg += "AND is the latest update on the CoC Blockchain.";
        }
        else if (hashResult.num >= 0) hashResult.msg += "BUT is NOT the latest update on the CoC Blockchain.";

        db.getCaseOfficerDetails(uniqueOfficer, 0).then(officerList => {
          for (let i = 0; i < evidenceList.length; i++) {
            evidenceList[i][7] = officerList.find(({ id }) => id == evidenceList[i][7]).username + ": " + evidenceList[i][7];
            evidenceList[i][9] = officerList.find(({ id }) => id == evidenceList[i][9]).username + ": " + evidenceList[i][9];
          }

          res.render('pages/evidenceList', {
            user_role: req.session.role,
            name: req.session.name,
            caseid: req.query.caseId,
            casename: caseName,
            caseuuid: caseUuid,
            evidenceid: req.query.evidenceId,
            evidenceuuid: evidenceUuid,
            evidence: evidenceList,
            hashresult: hashResult
          });
        });
      });
    });
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
  }
});


// Add Evidence Page
router.get('/addEvidence', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId))) throw new Error("Invalid Case Query Number");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  res.render('pages/addEvidence', {
    user_role: req.session.role,
    name: req.session.name,
    caseid: req.query.caseId
  });
});


// Add Evidence Submit Page
router.post('/addEvidence', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId))) throw new Error("Invalid Case Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    if (!caseUuid) throw new Error("Invalid Case UUID")
  } catch (err) {
    console.error(err);
    res.redirect('/caseInfo/?caseId=' + req.query.caseId);
    return;
  }

  const form = formidable(fileStore.formidableSettings);
  form.parse(req, (err, fields, files) => {
    if (err) {
      //next(err);
      console.log(err);
      res.redirect('/caseInfo/?caseId=' + req.query.caseId);
      return;
    }

    let uid = uuidv4();
    let datetime = new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ');
    let hash = files.uploadFile.hash;
    let evidenceName = fields.evidenceName;
    let locTime = fields.location + ',' + fields.evidenceTime + ',' + fields.evidenceDate;
    let evidenceDetails = fields.evidenceDetails;
    let owner = req.session.uuid;
    let ip = req.ip.slice(7);
    let eventLog = "Added to Blockchain";
    let actionBy = req.session.uuid;

    try {
      if (files.uploadFile.size === 0 || !evidenceName || !locTime || !evidenceDetails)
        throw new Error("Missing Input");
    } catch (err) {
      console.error(err);
      res.status(400).json("Missing Input");
      return;
    }

    dbfs.addEvidence(uid, files.uploadFile.path, datetime, hash).then(result => {
      if (result) {
        let evidence = [caseUuid, uid, evidenceName, datetime, eventLog, ip, hash, evidenceDetails, owner, locTime, actionBy];
        burrow.contract.LogEvidence(evidence).then(() => {
          res.redirect('/caseInfo/?caseId=' + req.query.caseId);
        });
      }
    }).catch(err => {
      console.error(err);
      res.status(400).json("Found Duplicated File Upload");
    });
  });
});




// Update Evidence Page
router.get('/updateEvidence', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Case/Evidence Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var caseName = Object.values(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    if (!caseUuid || !caseName || !evidenceUuid) throw new Error("Invalid Case/Evidence UUID or Case Name");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  burrow.contract.GetLatestCaseEvidence(caseUuid, evidenceUuid).then(ret => {
    var latestEvidence = ret.retEvidence.split('|');
    var locDateTime = latestEvidence[8].split(',');

    res.render('pages/updateEvidence', {
      user_role: req.session.role,
      name: req.session.name,
      evidenceName: latestEvidence[1],
      evidenceLocation: locDateTime[0],
      evidenceTime: locDateTime[1],
      evidenceDate: locDateTime[2],
      caseid: req.query.caseId,
      evidenceid: req.query.evidenceId
    });
  }).catch(err => res.send(handlerError(err)))
});



// Update Evidence Post Page
router.post('/updateEvidence', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Case/Evidence Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    if (!caseUuid || !evidenceUuid) throw new Error("Invalid Case/Evidence UUID");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  const form = formidable(fileStore.formidableSettings);
  form.parse(req, (err, fields, files) => {
    if (err) {
      next(err);
      return;
    }

    try {
      if (files.uploadFile.size === 0 || !fields.evidenceDetails)
        throw new Error("Missing Input");
    } catch (err) {
      console.error(err);
      res.status(400).json("Missing Input");
      return;
    }

    burrow.contract.GetLatestCaseEvidence(caseUuid, evidenceUuid).then(ret => {
      var latestEvidence = ret.retEvidence.split('|');
      latestEvidence.unshift(caseUuid);
      latestEvidence[3] = new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ');
      latestEvidence[4] = "Update Evidence";
      latestEvidence[5] = req.ip.slice(7);
      latestEvidence[6] = files.uploadFile.hash;
      latestEvidence[7] = fields.evidenceDetails;
      latestEvidence[10] = req.session.uuid;

      dbfs.addEvidence(latestEvidence[1], files.uploadFile.path, latestEvidence[3], latestEvidence[6]).then(() => {
        burrow.contract.LogEvidence(latestEvidence).then(() => {
          res.redirect('/caseInfo/?caseId=' + req.query.caseId);
        });
      }).catch(err => {
        console.error(err);
        res.status(400).json("Found Duplicated File Upload");
      });
    });
  });
});


// View Chain of Custody Page
router.get('/viewChainOfCustody', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId))) throw new Error("Invalid Case Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var caseName = Object.values(req.session.relevantCase)[req.query.caseId];
    if (!caseUuid || !caseName) throw new Error("Invalid Case UUID or Name")
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  burrow.contract.GetAllCaseEvidence(caseUuid).then(ret => {
    if (ret.retEvidence.length > 0) {
      var evidenceList = burrow.formatToArray(ret.retEvidence);
      uniqueOfficer = [];
      for (let i = 0; i < evidenceList.length; i++) {
        if (uniqueOfficer.indexOf(evidenceList[i][7]) === -1) uniqueOfficer.push(evidenceList[i][7]);
        if (uniqueOfficer.indexOf(evidenceList[i][9]) === -1) uniqueOfficer.push(evidenceList[i][9]);
      }

      db.getCaseOfficerDetails(uniqueOfficer, 0).then(officerList => {
        for (let i = 0; i < evidenceList.length; i++) {
          evidenceList[i][7] = officerList.find(({ id }) => id == evidenceList[i][7]).username + ": " + evidenceList[i][7];
          evidenceList[i][9] = officerList.find(({ id }) => id == evidenceList[i][9]).username + ": " + evidenceList[i][9];
        }

        res.render('pages/viewChainOfCustody', {
          user_role: req.session.role,
          name: req.session.name,
          caseuid: caseUuid,
          casename: caseName,
          evidence: evidenceList
        });
      });
    } else {
      var evidenceList = [];
      res.render('pages/viewChainOfCustody', {
        user_role: req.session.role,
        name: req.session.name,
        caseuid: caseUuid,
        casename: caseName,
        evidence: evidenceList
      });
    }
  });
});


// Update Ownership Page
router.get('/updateOwnership', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Case/Evidence Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    if (!caseUuid || !evidenceUuid) throw new Error("Invalid Case/Evidence UUID");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  burrow.contract.GetLatestCaseEvidence(caseUuid, evidenceUuid).then(ret => {
    var latestEvidence = ret.retEvidence.split('|');
    burrow.contract.GetCaseOfficers(caseUuid).then(value => {
      var caseOfficers = value.allCaseOfficers;
      var filtered = caseOfficers.filter(function (value, index, arr) { return value != latestEvidence[7]; });

      db.getCaseOfficerDetails(filtered, 1).then(officerList => {
        res.render('pages/updateOwnership', {
          user_role: req.session.role,
          name: req.session.name,
          caseuuid: caseUuid,
          evidenceuuid: evidenceUuid,
          officerList: officerList,
          evidenceName: latestEvidence[1],
          caseid: req.query.caseId,
          evidenceid: req.query.evidenceId
        });
      }).catch(err => res.send(handlerError(err)))
    });
  });
});


// Update Ownership Post Page
router.post('/updateOwnership', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Case/Evidence Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    if (!caseUuid || !evidenceUuid) throw new Error("Invalid Case/Evidence UUID");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  burrow.contract.GetLatestCaseEvidence(caseUuid, evidenceUuid).then(ret => {
    var latestEvidence = ret.retEvidence.split('|');
    latestEvidence.unshift(caseUuid);
    latestEvidence[3] = new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ');
    latestEvidence[4] = "Change Ownership";
    latestEvidence[5] = req.ip.slice(7);
    latestEvidence[7] = '-';
    latestEvidence[8] = req.body.officerName;
    latestEvidence[10] = req.session.uuid;

    burrow.contract.LogEvidence(latestEvidence).then(ret => {
      res.redirect('/caseInfo/?caseId=' + req.query.caseId);
    });
  });
});


// Remove Case
router.get('/closeCase', ac.isLoggedIn, ac.grantAccess('manager'), function (req, res) {
  try {
    if (isNaN(Number(req.query.caseId))) throw new Error("Invalid Case Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    if (!caseUuid) throw new Error("Invalid Case UUID or Name");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  burrow.contract.CloseCase(caseUuid).then(() => {
    res.redirect('/dashboard');
  });
});

const toolList = [
  {
    id: 0,
    "name": "Wireshark"
  },
  {
    id: 1,
    "name": "Volatility"
  }
]

const analysisList = [
  {
    id: 0,
    "name": "Simple"
  },
  {
    id: 1,
    "name": "Advanced"
  }
]

// Investigate Page
router.get('/investigate', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.pathId)) || isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Case/Evidence Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    // This specifies where the file is stored
    var filePath = req.session.currentEvidencePaths[req.query.pathId];
    if (!caseUuid || !evidenceUuid || !filePath) throw new Error("Invalid Case/Evidence UUID or File Path");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  // Not sure if all of this information is needed to just display the page.
  burrow.contract.GetLatestCaseEvidence(caseUuid, evidenceUuid).then(ret => {
    var latestEvidence = ret.retEvidence.split('|');
    burrow.contract.GetCaseOfficers(caseUuid).then(value => {
      var caseOfficers = value.allCaseOfficers;
      var filtered = caseOfficers.filter(function (value, index, arr) { return value != latestEvidence[7]; });

      db.getCaseOfficerDetails(filtered, 1).then(officerList => {
        res.render('pages/investigate', {
          user_role: req.session.role,
          name: req.session.name,
          caseuuid: caseUuid,
          evidenceuuid: evidenceUuid,
          officerList: officerList,
          evidenceName: latestEvidence[1],
          caseid: req.query.caseId,
          evidenceid: req.query.evidenceId,
          pathid: req.query.pathId,
          toolList: toolList,
          analysisList: analysisList,
          investigateDetails: ''
        });
      }).catch(err => res.send(handlerError(err)))
    });
  });
});


// Investigate Post Page
router.post('/investigate', ac.isLoggedIn, ac.isRelevantCaseLoaded, ac.grantAccess('manager', 'investigator'), function (req, res) {
  try {
    if (isNaN(Number(req.query.pathId)) || isNaN(Number(req.query.caseId)) || isNaN(Number(req.query.evidenceId))) throw new Error("Invalid Case/Evidence Query Number");
    var caseUuid = Object.keys(req.session.relevantCase)[req.query.caseId];
    var evidenceUuid = Object.keys(req.session.currentEvidenceList)[req.query.evidenceId];
    var filePath = req.session.currentEvidencePaths[req.query.pathId];
    if (!caseUuid || !evidenceUuid || !filePath) throw new Error("Invalid Case/Evidence UUID or File Path");
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
    return;
  }

  // Instantiate dockerode
  var docker = new Docker();
  // Obtain docker container using container name (can use id as well but it is unique so it will cause problems when merging)
  var container = docker.getContainer('admiring_nightingale');
  // Specify options needed to run a command on the container
  // For now, can run commands that display output to console (need to figure out how to run a command on a file that is on the host machine and not the docker)
  let params = {
    Cmd: ['wireshark', '-v'],
    AttachStdout: true,
    AttachStderr: true
  };
  // Run docker container exec
  container.exec(params, function(err, exec) {
    if(err) return;
    exec.start(function(err, stream){
      if(err) {
        console.log("error start: " + err);
        return;
      }
      // Streams the output onto the console using process.stdout (how to store this output? idk *shrug*)
      container.modem.demuxStream(stream, process.stdout, process.stderr);
    });
  });

  var investigateDetails = '';

  // Check for tool to run
  if (req.body.toolName == 0) {

    /*
    Analysis level selection logic
      - exec will run the tool and the output can be obtained from stdout (should be modified to use docker instead)
    */
    if (req.body.analysisName == 0) {
      console.log(`[Simple] Running wireshark on ${filePath} now...\n`);
      exec(`tshark -r ${filePath} -T fields -E header=y -e ip.src -e ip.dst -e ip.proto -e udp.dstport -e ip.len`, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          res.redirect('/dashboard');
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          res.redirect('/dashboard');
        }
        investigateDetails = stdout;
      });
    } else if (req.body.analysisName == 1) {
      console.log(`[Advanced] Running wireshark on ${filePath} now...\n`);
      exec(`tshark -r ${filePath} -V`, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          res.redirect('/dashboard');
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          res.redirect('/dashboard');
        }
        investigateDetails = stdout;
      })
    } else {
      res.redirect('/dashboard');
    }

  } else if (req.body.toolName == 1) {
    //Placeholder code, replace with tool execution afterwards
    console.log('Volatility test\n');
    investigateDetails = 'Placeholder text for results after executing tool';
  };

  // This information might be useful to record the investigative action onto the blockchain
  burrow.contract.GetLatestCaseEvidence(caseUuid, evidenceUuid).then(ret => {
    var latestEvidence = ret.retEvidence.split('|');
    burrow.contract.GetCaseOfficers(caseUuid).then(value => {
      var caseOfficers = value.allCaseOfficers;
      var filtered = caseOfficers.filter(function (value, index, arr) { return value != latestEvidence[7]; });

      db.getCaseOfficerDetails(filtered, 1).then(officerList => {
        res.render('pages/investigate', {
          user_role: req.session.role,
          name: req.session.name,
          caseuuid: caseUuid,
          evidenceuuid: evidenceUuid,
          officerList: officerList,
          evidenceName: latestEvidence[1],
          caseid: req.query.caseId,
          evidenceid: req.query.evidenceId,
          pathid: req.query.pathId,
          toolList: toolList,
          analysisList: analysisList,
          toolName: req.body.toolName,
          investigateDetails: investigateDetails
        });
      }).catch(err => res.send(handlerError(err)))
    });
  });

});

module.exports = router;
