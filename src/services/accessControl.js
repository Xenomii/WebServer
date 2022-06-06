exports.isLoggedIn = function(req, res, next) {
  if (!req.session.login)
    return res.redirect('/');
  next()
}

exports.grantAccess = function() {
  return async (req, res, next) => {
    try {
      let accessGranted = false;
      for (let i = 0; i < arguments.length; i++) {
         if (req.session.role === arguments[i]) {
            accessGranted = true;
            break;
         }
      }
      if (!accessGranted) {
        return res.status(401).json({
          error: "You don't have enough permission to perform this action"
        });
      }
      next();
    } catch (error) {
      next(error)
    }
  }
}

exports.isRelevantCaseLoaded = function(req, res, next) {
  if (!req.session.relevantCase)
    return res.redirect('/dashboard');
  next()
}