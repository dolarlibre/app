require("dotenv").config();
const { batchDeploy } = require("../jobs/batch-deploy");

const test = async () => {
  const res = await batchDeploy({ count: 1 });
  console.log("res", res);
};

test();