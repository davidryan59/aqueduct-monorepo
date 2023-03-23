import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";
require("dotenv").config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            forking: {
                url: process.env.GOERLI_ALCHEMY_KEY || "",
            },
            gas: 1800000,
        },
        goerli: {
            url: process.env.GOERLI_ALCHEMY_KEY || "",
            accounts: [process.env.PRIVATE_KEY || ""],
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v5",
    },
    mocha: {
        timeout: 200000,
    },
};

export default config;
