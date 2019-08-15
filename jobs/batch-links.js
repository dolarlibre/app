require("dotenv").config();
const AWS = require("aws-sdk");
var credentials = new AWS.SharedIniFileCredentials({ profile: "default" });
AWS.config.credentials = credentials;
AWS.config.update({ region: "us-east-1" });

const { send } = require("../links/send");

const batchLinks = count => {
  try {
    let req = {
      body: JSON.stringify({
        amount: ".01",
        senderAddress: process.env.OMI_ADDRESS
      })
    };

    for (let i = 0; i < count; i++) {
      send(req);
    }

    return {
      statusCode: 200,
      body: "ok"
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 400,
      body: err
    };
  }
};

batchLinks(10);