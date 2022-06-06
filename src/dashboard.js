const express = require('express');
const ac = require('./services/accessControl.js');
const db = require('./services/database.js');
const burrow = require('./services/burrow.js');
const router = express.Router();


router.get('/dashboard', ac.isLoggedIn, function (req, res) {
    delete req.session.relevantCase;

    if (req.session.firstlogin === 0) {
        res.redirect('/changePassword');
	return;
    }

    if (req.session.role === 'manager' || req.session.role === 'investigator') {
        burrow.contract.GetAllOfficerCase(req.session.uuid).then(ret => {
            req.session.relevantCase = {}
            for (let i = 0; i < ret.caseUuid.length; i++)
                req.session.relevantCase[ret.caseUuid[i]] = ret.caseName[i];
            res.render('pages/dashboard',{
                caseUuid: ret.caseUuid,
                caseName: ret.caseName,
                caseDetails: ret.caseDetails,
                name: req.session.name,
                user_role: req.session.role,
                closed: ret.caseClosed
            });
        });
    }
    else {
        db.getUL().then((results) => {
            var ulResults = results;
            res.render('pages/dashboard',{
                name: req.session.name,
                user_role: req.session.role,
                ulResults: ulResults
            });
        });
    }
});


module.exports = router;
