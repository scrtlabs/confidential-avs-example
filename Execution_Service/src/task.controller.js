"use strict";
const { Router } = require("express")
const multer = require("multer");
const CustomError = require("./utils/validateError");
const CustomResponse = require("./utils/validateResponse");
const dalService = require("./dal.service");
const kycService = require("./kyc.service");
const router = Router()

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow PNG files
        if (file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Only PNG files are allowed!'), false);
        }
    }
});

router.post("/execute", upload.single('image'), async (req, res) => {
    console.log("Executing task");

    try {
        var taskDefinitionId = Number(req.body.taskDefinitionId) || 0;
        console.log(`taskDefinitionId: ${taskDefinitionId}`);
        
        // Get public_key from request body
        const public_key = req.body.public_key;
        if (!public_key) {
            return res.status(400).send(new CustomError("public_key parameter is required", {}));
        }
        console.log(`public_key: ${public_key}`);
        
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).send(new CustomError("No PNG file uploaded. Please upload a PNG image.", {}));
        }

        console.log(`Received file: ${req.file.originalname}, size: ${req.file.size} bytes`);
        
        // Pass the uploaded file buffer to uploadKycImage
        const result = await kycService.uploadKycImage(req.file.buffer);

        
        const cid = await dalService.publishJSONToIpfs(result);
        let ageString = '';
        if (result.response.identity.over_21) {
            ageString = 'over_21';
        } else if (result.response.identity.over_18) {
            ageString = 'over_18';
        }
        const data = `${public_key}_${ageString}`;

        console.log("Sending task to DAL", data);
        await dalService.sendTask(cid, data, taskDefinitionId);
        
        return res.status(200).send(new CustomResponse({proofOfTask: cid, data: data, taskDefinitionId: taskDefinitionId, public_key: public_key}, "Task executed successfully"));
    } catch (error) {
        console.log(error)
        // Handle multer errors specifically
        if (error.message === 'Only PNG files are allowed!') {
            return res.status(400).send(new CustomError("Only PNG files are allowed!", {}));
        }
        return res.status(500).send(new CustomError("Something went wrong", {}));
    }
})


module.exports = router
