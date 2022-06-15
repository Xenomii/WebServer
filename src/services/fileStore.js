const config = require("./config.js");

const fixedUploadPath = config.get().UploadPath;
console.log(`Location of all upload goes to: ${fixedUploadPath}`)

exports.formidableSettings = {
    uploadDir: fixedUploadPath,
    keepExtensions: true,
    hash: 'sha256',
    multiples: false,
    //Set max file size allowed for upload to 4GB, default 200MB
    maxFileSize: 4 * 1024 * 1024 * 1024
}
