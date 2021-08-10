"use strict";

const {
  SdkEnvironmentNames,
  getSdkEnvironment,
  createSdk
} = require("@archanova/sdk");

const { validAddress } = require("../util/address-auth");
const { omiPrivateKey } = require("../util/secret");
const {
  getUnclaimedAccounts,
  getClaimedAccounts,
  updateRecord
} = require("../util/dyanamo-queries");

const { BN } = require('bn.js')

module.exports.signup = async (event, context) => {
  const reqData = JSON.parse(event.body);
  const timestamp = new Date().getTime();
  console.log('User Device Address', reqData.userDeviceAddress)
  console.log('ENV', {
    DYNAMODB_TABLE: process.env.DYNAMODB_TABLE,
    DYNAMODB_ACCOUNT_TABLE: process.env.DYNAMODB_ACCOUNT_TABLE,
    ORIGIN: process.env.ORIGIN,
    OMI_ADDRESS: process.env.OMI_ADDRESS,
    APP_URL: process.env.APP_URL,
    OMI_PK: process.env.OMI_PK,
    POA_NETWORK: process.env.POA_NETWORK,
    SDK_ENV: process.env.SDK_ENV,
  });
  const authorized = validAddress(reqData.userDeviceAddress);

  if (!reqData || !reqData.userDeviceAddress || !authorized) {
    console.error("Validation Failed");
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": process.env.ORIGIN
      },
      body: JSON.stringify({ error: "missing values" })
    };
  }

  try {
    const claimedAccounts = await getClaimedAccounts();
    const deviceAssigned = claimedAccounts.Items.find(account => {
      return account.appDeviceId == reqData.userDeviceAddress;
    });

    if (deviceAssigned) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.ORIGIN
        },
        body: JSON.stringify(deviceAssigned)
      };
    }

    // FIX: not using OMI private key. Not sure what this encrypted data refers to.
    const guardianPK = await omiPrivateKey();
    const sdkEnv = getSdkEnvironment(SdkEnvironmentNames[process.env.SDK_ENV]);
    const sdk = new createSdk(sdkEnv);

    await sdk.initialize({ device: { privateKey: guardianPK } });
    // const accounts = await sdk.getConnectedAccounts()
    // const created = await sdk.createAccount()
    // const connected = await sdk.connectAccount('0x06A418b0F2dbc71beF8FD7069469768607B51459');
    // return {accounts, connected, created};

    const unclaimedAccounts = await getUnclaimedAccounts();
    console.log('unclaimed', unclaimedAccounts);
    const account = unclaimedAccounts.Items[0];
    console.log('account', account);

    if (account) {
      console.log('accountAddress', account.accountAddress);
      const connectRes = await sdk.connectAccount(account.accountAddress);
      console.log("connectRes");
      console.log(connectRes);

      if (connectRes) {
        const deviceRes = await sdk.createAccountDevice(
          reqData.userDeviceAddress
        );
        console.log("deviceRes", deviceRes);

        const deploymentEstimate = await sdk.estimateAccountDeviceDeployment(
          reqData.userDeviceAddress
        );
        console.log("deploymentEstimate", deploymentEstimate);

        const deployHash = await sdk.submitAccountTransaction(
          deploymentEstimate
        );
        console.log("deployHash", deployHash);

        const updateParams = {
          TableName: process.env.DYNAMODB_ACCOUNT_TABLE,
          Key: {
            accountAddress: account.accountAddress
          },
          ExpressionAttributeValues: {
            ":claimed": true,
            ":appDeviceId": reqData.userDeviceAddress,
            ":updatedAt": timestamp
          },
          UpdateExpression: `SET claimed = :claimed, appDeviceId = :appDeviceId, updatedAt = :updatedAt`,
          ReturnValues: "ALL_NEW"
        };

        await updateRecord(updateParams);

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": process.env.ORIGIN
          },
          body: JSON.stringify(account)
        };
      } else {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": process.env.ORIGIN
          },
          body: JSON.stringify({ error: "No connection" })
        };
      }
    } else {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.ORIGIN
        },
        body: JSON.stringify({ error: "There are no available accounts" })
      };
    }
  } catch (err) {
    console.log(err);
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": process.env.ORIGIN
      },
      body: JSON.stringify({ error: err })
    };
  }
};
