const config = require("./config.js");

const fixedUploadPath = config.get().UploadPath;
console.log(`Location of all upload goes to: ${fixedUploadPath}`)

exports.formidableSettings = {
    uploadDir: fixedUploadPath,
    keepExtensions: true,
    hash: 'sha256',
    multiples: false
}
