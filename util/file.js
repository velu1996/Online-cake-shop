const fs = require('fs');

const deleteFile = (filePath)=>{
    console.log(filePath);
    fs.unlink(filePath,(err)=>{
        if(err){
            // console.log(err);
            throw (err);
        }
    });
}

exports.deleteFile = deleteFile;