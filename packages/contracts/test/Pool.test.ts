import { ethers } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import { Framework, TestToken } from "@superfluid-finance/sdk-core";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Signer } from "ethers";

import { abi as daiAbi } from "../artifacts/contracts/tokens/IERC20.sol/IERC20.json";
import { AqueductToken, Pool, Pool__factory } from "../typechain";
require("dotenv").config();

// test wallets
const testWalletAddress = "0x91AdDB0E8443C83bAf2aDa6B8157B38f814F0bcC";

// tokens
const fdaixAddress = "0x88271d333C72e51516B67f5567c728E702b3eeE8";
const daiAddress = "0x88271d333C72e51516B67f5567c728E702b3eeE8";
const usdcAddress = "0xc94dd466416A7dFE166aB2cF916D3875C049EBB7";
const flowScheduler = "0xA6134E107FCAEAab6140CB8fb92Dbf5bd9EF6C86";

// superfluid
const superfluidHost = "0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9";
const resolverAddress = "0x3710AB3fDE2B61736B8BB0CE845D6c61F667a78E";

describe("SuperApp Tests", function () {
    // global vars to be assigned in beforeEach
    let SuperApp: Pool__factory;
    let superApp: Pool;
    let token0: AqueductToken;
    let token1: AqueductToken;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;
    let addr4: SignerWithAddress;
    let addr5: SignerWithAddress;
    let addr6: SignerWithAddress;
    let addr7: SignerWithAddress;
    let addrs: Array<SignerWithAddress>;
    let testWalletSigner: SignerWithAddress;

    // superfluid
    let sf: any;
    let signer: Signer;
    let addr1Signer: Signer;
    let addr2Signer: Signer;
    let addr3Signer: Signer;
    let addr4Signer: Signer;
    let addr5Signer: Signer;
    let addr6Signer: Signer;
    let addr7Signer: Signer;

    // delay helper function
    const delay = async (seconds: number) => {
        await hre.ethers.provider.send("evm_increaseTime", [seconds]);
        await hre.ethers.provider.send("evm_mine", []);
    };

    const addDepositToBalanceSum = async (
        balanceSum: BigNumber,
        flow0SuperToken: string,
        flow1SuperToken: string,
        senderAddress: string,
        receiverAddress: string
    ) => {
        const deposit0 = (
            await sf.cfaV1.getFlow({
                superToken: flow0SuperToken,
                sender: senderAddress,
                receiver: receiverAddress,
                providerOrSigner: addr1Signer,
            })
        ).deposit;

        const deposit1 = (
            await sf.cfaV1.getFlow({
                superToken: flow1SuperToken,
                sender: senderAddress,
                receiver: receiverAddress,
                providerOrSigner: addr1Signer,
            })
        ).deposit;

        balanceSum.add(ethers.utils.parseUnits(deposit0));
        balanceSum.add(ethers.utils.parseUnits(deposit1));

        return balanceSum;
    };

    const logSumOfAllBalances = async () => {
        const lpToken0Balance = await token0.balanceOf(testWalletAddress);
        const lpToken1Balance = await token1.balanceOf(testWalletAddress);
        const lpTotalBalance = lpToken0Balance.add(lpToken1Balance);

        const poolToken0Balance = await token0.balanceOf(superApp.address);
        const poolToken1Balance = await token1.balanceOf(superApp.address);
        const poolTotalBalance = poolToken0Balance.add(poolToken1Balance);

        const userAToken0Balance = await token0.balanceOf(addr1.address);
        const userAToken1Balance = await token1.balanceOf(addr1.address);
        const userATotalBalance = userAToken0Balance.add(userAToken1Balance);

        const userBToken0Balance = await token0.balanceOf(addr2.address);
        const userBToken1Balance = await token1.balanceOf(addr2.address);
        const userBTotalBalance = userBToken0Balance.add(userBToken1Balance);

        const lp2Token0Balance = await token0.balanceOf(addr3.address);
        const lp2Token1Balance = await token1.balanceOf(addr3.address);
        const lp2TotalBalance = lp2Token0Balance.add(lp2Token1Balance);

        lpTotalBalance.add(
            await addDepositToBalanceSum(
                lpTotalBalance,
                token0.address,
                token1.address,
                testWalletAddress,
                superApp.address
            )
        );

        poolTotalBalance.add(
            await addDepositToBalanceSum(
                poolTotalBalance,
                token0.address,
                token1.address,
                testWalletAddress,
                superApp.address
            )
        );

        lpTotalBalance.add(
            await addDepositToBalanceSum(
                lpTotalBalance,
                token0.address,
                token1.address,
                addr1.address,
                superApp.address
            )
        );

        poolTotalBalance.add(
            await addDepositToBalanceSum(
                poolTotalBalance,
                token0.address,
                token1.address,
                superApp.address,
                addr1.address
            )
        );

        userBToken0Balance.add(
            await addDepositToBalanceSum(
                userBToken0Balance,
                token0.address,
                token1.address,
                addr2.address,
                superApp.address
            )
        );

        userBToken0Balance.add(
            await addDepositToBalanceSum(
                userBToken0Balance,
                token0.address,
                token1.address,
                superApp.address,
                addr2.address
            )
        );

        lp2TotalBalance.add(
            await addDepositToBalanceSum(
                lp2TotalBalance,
                token0.address,
                token1.address,
                addr3.address,
                superApp.address
            )
        );

        poolTotalBalance.add(
            await addDepositToBalanceSum(
                poolTotalBalance,
                token0.address,
                token1.address,
                superApp.address,
                addr3.address
            )
        );

        // log all
        console.log("LP sum: " + lpTotalBalance);
        console.log("LP2 sum: " + lp2TotalBalance);
        console.log("Pool sum: " + poolTotalBalance);
        console.log("UserA sum: " + userATotalBalance);
        console.log("UserB sum: " + userBTotalBalance);
        console.log(
            "Sum of all balances: " +
                lpTotalBalance.add(lp2TotalBalance).add(poolTotalBalance).add(userATotalBalance).add(userBTotalBalance)
        );
    };

    const logAllBalances = async () => {
        /*console.log('____________________________')
        console.log('rt 0: ' + (await superApp.getRealTimeFeesCumulative(token0.address)));
        console.log('rt 1: ' + (await superApp.getRealTimeFeesCumulative(token1.address)));
        console.log('FC 0: ' + (await superApp.getFeesCumulativeAtTime2(token0.address)));
        console.log('FC 1: ' + (await superApp.getFeesCumulativeAtTime2(token1.address)));*/
        console.log("__________________________________");
        console.log(
            "LP:  " + (await token0.balanceOf(testWalletAddress)) + ",  " + (await token1.balanceOf(testWalletAddress))
        );
        /*console.log('LP ∆:  ' + await superApp.getRealTimeUserCumulativeDelta(token0.address, testWalletAddress) + ',  ' + await superApp.getRealTimeUserCumulativeDelta(token1.address, testWalletAddress));
        console.log('LP nF:  ' + await superApp.getTwapNetFlowRate(token0.address, testWalletAddress) + ',  ' + await superApp.getTwapNetFlowRate(token1.address, testWalletAddress));
        console.log('LP sfF:  ' + await sf.cfaV1.getNetFlow({superToken: token0.address, account: testWalletAddress, providerOrSigner: addr1Signer}) + ',  ' + await sf.cfaV1.getNetFlow({superToken: token1.address, account: testWalletAddress, providerOrSigner: addr1Signer}));
        console.log('lp deposits 0: ' + ((await sf.cfaV1.getFlow({superToken: token0.address, sender: testWalletAddress, receiver: superApp.address, providerOrSigner: testWalletSigner})).deposit / 1));
        console.log('lp deposits 1: ' + ((await sf.cfaV1.getFlow({superToken: token1.address, sender: testWalletAddress, receiver: superApp.address, providerOrSigner: testWalletSigner})).deposit / 1));
        console.log('lp rewards 0: ' + await superApp.getRealTimeUserReward(token0.address, testWalletAddress));
        console.log('lp rewards 1: ' + await superApp.getRealTimeUserReward(token1.address, testWalletAddress));*/

        console.log(
            "LP2:  " + (await token0.balanceOf(addr3.address)) + ",  " + (await token1.balanceOf(addr3.address))
        );
        /*console.log('LP2 ∆:  ' + await superApp.getRealTimeUserCumulativeDelta(token0.address, addr3.address) + ',  ' + await superApp.getRealTimeUserCumulativeDelta(token1.address, addr3.address));
        console.log('LP2 nF:  ' + await superApp.getTwapNetFlowRate(token0.address, addr3.address) + ',  ' + await superApp.getTwapNetFlowRate(token1.address, addr3.address));
        console.log('LP2 sfF:  ' + await sf.cfaV1.getNetFlow({superToken: token0.address, account: addr3.address, providerOrSigner: addr1Signer}) + ',  ' + await sf.cfaV1.getNetFlow({superToken: token1.address, account: addr3.address, providerOrSigner: addr1Signer}));
        console.log('lp2 deposits 0: ' + ((await sf.cfaV1.getFlow({superToken: token0.address, sender: addr3.address, receiver: superApp.address, providerOrSigner: addr3Signer})).deposit / 1));
        console.log('lp2 deposits 1: ' + ((await sf.cfaV1.getFlow({superToken: token1.address, sender: addr3.address, receiver: superApp.address, providerOrSigner: addr3Signer})).deposit / 1));
        console.log('lp2 rewards 0: ' + await superApp.getRealTimeUserReward(token0.address, addr3.address));
        console.log('lp2 rewards 1: ' + await superApp.getRealTimeUserReward(token1.address, addr3.address));*/

        console.log(
            "pool:  " + (await token0.balanceOf(superApp.address)) + ",  " + (await token1.balanceOf(superApp.address))
        );
        /*console.log('pool ∆:  ' + await superApp.getRealTimeUserCumulativeDelta(token0.address, superApp.address) + ',  ' + await superApp.getRealTimeUserCumulativeDelta(token1.address, superApp.address));
        console.log('pool nF:  ' + await superApp.getTwapNetFlowRate(token0.address, superApp.address) + ',  ' + await superApp.getTwapNetFlowRate(token1.address, superApp.address));
        console.log('pool sfF:  ' + await sf.cfaV1.getNetFlow({superToken: token0.address, account: superApp.address, providerOrSigner: addr1Signer}) + ',  ' + await sf.cfaV1.getNetFlow({superToken: token1.address, account: superApp.address, providerOrSigner: addr1Signer}));
        var poolDeposits0 = (await sf.cfaV1.getFlow({superToken: token0.address, sender: superApp.address, receiver: testWalletAddress, providerOrSigner: addr1Signer})).deposit / 1;
        poolDeposits0 += (await sf.cfaV1.getFlow({superToken: token0.address, sender: superApp.address, receiver: addr1.address, providerOrSigner: addr1Signer})).deposit / 1;
        poolDeposits0 += (await sf.cfaV1.getFlow({superToken: token0.address, sender: superApp.address, receiver: addr2.address, providerOrSigner: addr1Signer})).deposit / 1;
        console.log('pool deposits 0: ' + poolDeposits0);
        var poolDeposits1 = (await sf.cfaV1.getFlow({superToken: token1.address, sender: superApp.address, receiver: testWalletAddress, providerOrSigner: addr1Signer})).deposit / 1;
        poolDeposits1 += (await sf.cfaV1.getFlow({superToken: token1.address, sender: superApp.address, receiver: addr1.address, providerOrSigner: addr1Signer})).deposit / 1;
        poolDeposits1 += (await sf.cfaV1.getFlow({superToken: token1.address, sender: superApp.address, receiver: addr2.address, providerOrSigner: addr1Signer})).deposit / 1;
        console.log('pool deposits 1: ' + poolDeposits1);
        console.log('pool rewards 0: ' + await superApp.getRealTimeUserReward(token0.address, superApp.address));
        console.log('pool rewards 1: ' + await superApp.getRealTimeUserReward(token1.address, superApp.address));*/

        console.log(
            "userA:  " + (await token0.balanceOf(addr1.address)) + ",  " + (await token1.balanceOf(addr1.address))
        );
        /*console.log('userA ∆:  ' + await superApp.getRealTimeUserCumulativeDelta(token0.address, addr1.address) + ',  ' + await superApp.getRealTimeUserCumulativeDelta(token1.address, addr1.address));
        console.log('userA nF:  ' + await superApp.getTwapNetFlowRate(token0.address, addr1.address) + ',  ' + await superApp.getTwapNetFlowRate(token1.address, addr1.address));
        console.log('userA sfF:  ' + await sf.cfaV1.getNetFlow({superToken: token0.address, account: addr1.address, providerOrSigner: addr1Signer}) + ',  ' + await sf.cfaV1.getNetFlow({superToken: token1.address, account: addr1.address, providerOrSigner: addr1Signer}));
        console.log('userA deposits 0: ' + ((await sf.cfaV1.getFlow({superToken: token0.address, sender: addr1.address, receiver: superApp.address, providerOrSigner: addr1Signer})).deposit / 1));
        console.log('userA deposits 1: ' + ((await sf.cfaV1.getFlow({superToken: token1.address, sender: addr1.address, receiver: superApp.address, providerOrSigner: addr1Signer})).deposit / 1));
        console.log('userA rewards 0: ' + await superApp.getRealTimeUserReward(token0.address, addr1.address));
        console.log('userA rewards 1: ' + await superApp.getRealTimeUserReward(token1.address, addr1.address));*/

        console.log(
            "userB:  " + (await token0.balanceOf(addr2.address)) + ",  " + (await token1.balanceOf(addr2.address))
        );
        /*console.log('userB ∆:  ' + await superApp.getRealTimeUserCumulativeDelta(token0.address, addr2.address) + ',  ' + await superApp.getRealTimeUserCumulativeDelta(token1.address, addr2.address));
        console.log('userB nF:  ' + await superApp.getTwapNetFlowRate(token0.address, addr2.address) + ',  ' + await superApp.getTwapNetFlowRate(token1.address, addr2.address));
        console.log('userB sfF:  ' + await sf.cfaV1.getNetFlow({superToken: token0.address, account: addr2.address, providerOrSigner: addr2Signer}) + ',  ' + await sf.cfaV1.getNetFlow({superToken: token1.address, account: addr2.address, providerOrSigner: addr2Signer}));
        console.log('userB deposits 0: ' + ((await sf.cfaV1.getFlow({superToken: token0.address, sender: addr2.address, receiver: superApp.address, providerOrSigner: addr2Signer})).deposit / 1));
        console.log('userB deposits 1: ' + ((await sf.cfaV1.getFlow({superToken: token1.address, sender: addr2.address, receiver: superApp.address, providerOrSigner: addr2Signer})).deposit / 1));
        console.log('userB rewards 0: ' + await superApp.getRealTimeUserReward(token0.address, addr2.address));
        console.log('userB rewards 1: ' + await superApp.getRealTimeUserReward(token1.address, addr2.address));*/
    };

    // runs before every test
    beforeEach(async function () {
        // get signers
        [owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, ...addrs] = await ethers.getSigners();
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [testWalletAddress],
        });
        testWalletSigner = await ethers.getSigner(testWalletAddress);

        // deploy SuperApp
        SuperApp = await ethers.getContractFactory("Pool");
        superApp = await SuperApp.deploy(superfluidHost);
        await superApp.deployed();

        // deploy tokens
        let Token = await ethers.getContractFactory("AqueductToken");
        token0 = await Token.deploy(superfluidHost, superApp.address);
        await token0.deployed();
        await token0.initialize(daiAddress, 18, "Aqueduct Token", "AQUA");

        token1 = await Token.deploy(superfluidHost, superApp.address);
        await token1.deployed();
        await token1.initialize(daiAddress, 18, "Aqueduct Token 2", "AQUA2");

        // init pool
        const poolFee = BigInt(2 ** 128 * 0.01); // 1% fee - multiply by 2^112 to conform to UQ112x112
        //const poolFee = 0;
        await superApp.initialize(token0.address, token1.address, poolFee, flowScheduler);

        // init superfluid sdk
        sf = await Framework.create({
            chainId: 31337,
            provider: ethers.provider,
            resolverAddress: resolverAddress,
        });

        signer = sf.createSigner({
            privateKey: process.env.PRIVATE_KEY,
            provider: ethers.provider,
        });

        let addr1PC = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
        addr1Signer = sf.createSigner({
            privateKey: addr1PC,
            provider: ethers.provider,
        });

        let addr2PC = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
        addr2Signer = sf.createSigner({
            privateKey: addr2PC,
            provider: ethers.provider,
        });

        let addr3PC = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";
        addr3Signer = sf.createSigner({
            privateKey: addr3PC,
            provider: ethers.provider,
        });

        let addr4PC = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a";
        addr4Signer = sf.createSigner({
            privateKey: addr4PC,
            provider: ethers.provider,
        });

        let addr5PC = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba";
        addr5Signer = sf.createSigner({
            privateKey: addr5PC,
            provider: ethers.provider,
        });

        let addr6PC = "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e";
        addr6Signer = sf.createSigner({
            privateKey: addr6PC,
            provider: ethers.provider,
        });

        let addr7PC = "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";
        addr7Signer = sf.createSigner({
            privateKey: addr7PC,
            provider: ethers.provider,
        });
    });

    describe("generic streaming tests", function () {
        // Sum of all balances: 200000000000000000029 whereas before migration, it was 200000000000000000000
        it("test stream (expected no revert)", async function () {
            // log addresses for testing
            console.log("superApp address: " + superApp.address);
            console.log("lp address: " + testWalletAddress);
            console.log("userA address: " + addr1.address);
            console.log("userB address: " + addr2.address);

            // get first block (for tracking events)
            //const firstBlock = (await ethers.provider.getBlock("latest")).number;

            // upgrade tokens
            const daiContract = new ethers.Contract(daiAddress, daiAbi) as TestToken;
            let amnt = "100000000000000000000"; // 100
            await daiContract.connect(testWalletSigner).approve(token0.address, amnt);
            await token0.connect(testWalletSigner).upgrade(amnt);
            await daiContract.connect(testWalletSigner).approve(token1.address, amnt);
            await token1.connect(testWalletSigner).upgrade(amnt);

            // manually add liquidity to the pool
            let amnt2 = "10000000000000000000"; // 10
            await token0.connect(testWalletSigner).transfer(superApp.address, amnt2);
            await token1.connect(testWalletSigner).transfer(superApp.address, amnt2);

            // TODO: require these
            //console.log("Contract's token0 balance: " + (await token0.balanceOf(superApp.address) / 10**18));
            //console.log("Contract's token1 balance: " + (await token1.balanceOf(superApp.address) / 10**18));

            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            await logAllBalances();
            await logSumOfAllBalances();

            // create flow of token0 into the Super App
            console.log("\n_____ LP token0 --> token1 _____");
            const createFlowOperation = sf.cfaV1.createFlow({
                sender: testWalletAddress,
                receiver: superApp.address,
                superToken: token0.address,
                flowRate: "10000000000000",
                overrides: { gasLimit: 10000000 },
            });
            const createFlowRes = await createFlowOperation.exec(signer);
            await createFlowRes.wait();

            await logAllBalances();
            await logSumOfAllBalances();

            // create flow of token1 into the Super App
            console.log("\n_____ LP token0 <-- token1 _____");
            const createFlowOperation2 = sf.cfaV1.createFlow({
                sender: testWalletAddress,
                receiver: superApp.address,
                superToken: token1.address,
                flowRate: "10000000000000",
            });
            const createFlowRes2 = await createFlowOperation2.exec(signer);
            await createFlowRes2.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            await logAllBalances();
            await logSumOfAllBalances();

            // perform one way swap with second test wallet
            console.log("\n_____ User A token0 --> token1 _____");
            await token0.connect(testWalletSigner).transfer(addr1.address, amnt2); // transfer some tokens to addr1
            //console.log("User's token0 balance: " + await token0.balanceOf(addr1.address));
            const createFlowOperation3 = sf.cfaV1.createFlow({
                sender: addr1.address,
                receiver: superApp.address,
                superToken: token0.address,
                flowRate: "1000000000000", //"10000000000"
            });
            const createFlowRes3 = await createFlowOperation3.exec(addr1Signer);
            await createFlowRes3.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            // provide liquidity from a second account
            await token0.connect(testWalletSigner).transfer(addr3.address, amnt2); // transfer some tokens to addr3
            await token1.connect(testWalletSigner).transfer(addr3.address, amnt2); // transfer some tokens to addr3
            console.log("\n_____ LP2 token0 --> token1 _____");
            const createFlowOperation5 = sf.cfaV1.createFlow({
                sender: addr3.address,
                receiver: superApp.address,
                superToken: token0.address,
                flowRate: "100000000000",
            });
            const createFlowRes5 = await createFlowOperation5.exec(addr3Signer);
            await createFlowRes5.wait();

            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            await logAllBalances();
            await logSumOfAllBalances();

            // provide liquidity in the other direction
            console.log("\n_____ LP2 token0 <-- token1 _____");
            const createFlowOperation6 = sf.cfaV1.createFlow({
                sender: addr3.address,
                receiver: superApp.address,
                superToken: token1.address,
                flowRate: "100000000000",
            });
            const createFlowRes6 = await createFlowOperation6.exec(addr3Signer);
            await createFlowRes6.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            await logAllBalances();
            await logSumOfAllBalances();

            // perform one way swap in opposite direction with third test wallet
            console.log("\n_____ User B token0 <-- token1 _____");
            await token1.connect(testWalletSigner).transfer(addr2.address, amnt2); // transfer some tokens to addr2
            const createFlowOperation4 = sf.cfaV1.createFlow({
                sender: addr2.address,
                receiver: superApp.address,
                superToken: token1.address,
                flowRate: "1000000000000", //"5000000"
            });
            const createFlowRes4 = await createFlowOperation4.exec(addr2Signer);
            await createFlowRes4.wait();

            /*
            var firstBlock = (await ethers.provider.getBlock("latest")).number;

            await superApp.connect(testWalletSigner).testUserReward(token0.address, testWalletAddress);
            await superApp.connect(testWalletSigner).testUserReward(token1.address, testWalletAddress);

            // get all events
            var currentBlock = (await ethers.provider.getBlock("latest")).number;
            console.log((await superApp.queryFilter("userReward", firstBlock, currentBlock)));
            */

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            // cancel flows
            console.log("\n_____ User B token0 <-x- token1 _____");
            const deleteFlowOperation = sf.cfaV1.deleteFlow({
                sender: addr2.address,
                receiver: superApp.address,
                superToken: token1.address,
            });
            const deleteFlowRes = await deleteFlowOperation.exec(addr2Signer);
            await deleteFlowRes.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            console.log("\n_____ LP2 token0 <-x- token1 _____");
            const deleteFlowOperation2 = sf.cfaV1.deleteFlow({
                sender: addr3.address,
                receiver: superApp.address,
                superToken: token1.address,
            });
            const deleteFlowRes2 = await deleteFlowOperation2.exec(addr3Signer);
            await deleteFlowRes2.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            console.log("\n_____ LP2 token0 -x-> token1 _____");
            const deleteFlowOperation3 = sf.cfaV1.deleteFlow({
                sender: addr3.address,
                receiver: superApp.address,
                superToken: token0.address,
            });
            const deleteFlowRes3 = await deleteFlowOperation3.exec(addr3Signer);
            await deleteFlowRes3.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            console.log("\n_____ User A token0 -x-> token1 _____");
            const deleteFlowOperation4 = sf.cfaV1.deleteFlow({
                sender: addr1.address,
                receiver: superApp.address,
                superToken: token0.address,
            });
            const deleteFlowRes4 = await deleteFlowOperation4.exec(addr1Signer);
            await deleteFlowRes4.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            console.log("\n_____ LP token0 <-x- token1 _____");
            const deleteFlowOperation5 = sf.cfaV1.deleteFlow({
                sender: testWalletAddress,
                receiver: superApp.address,
                superToken: token1.address,
            });
            const deleteFlowRes5 = await deleteFlowOperation5.exec(testWalletSigner);
            await deleteFlowRes5.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            console.log("\n_____ LP token0 -x-> token1 _____");
            const deleteFlowOperation6 = sf.cfaV1.deleteFlow({
                sender: testWalletAddress,
                receiver: superApp.address,
                superToken: token0.address,
            });
            const deleteFlowRes6 = await deleteFlowOperation6.exec(testWalletSigner);
            await deleteFlowRes6.wait();

            // all
            await logAllBalances();
            await logSumOfAllBalances();

            await delay(36000);

            // all
            await logAllBalances();
            await logSumOfAllBalances();
        });

        it("Flow gets liquidated", async function () {
            // upgrade tokens
            const daiContract = new ethers.Contract(daiAddress, daiAbi) as TestToken;

            let amnt = "100000000000000000000"; // 100
            await daiContract.connect(testWalletSigner).approve(token0.address, amnt);
            await token0.connect(testWalletSigner).upgrade(amnt);
            await daiContract.connect(testWalletSigner).approve(token1.address, amnt);
            await token1.connect(testWalletSigner).upgrade(amnt);

            // Provide liquidity to pool
            console.log("\n_____ LP token0 --> token1 _____");
            const createFlowOperation = sf.cfaV1.createFlow({
                sender: testWalletAddress,
                receiver: superApp.address,
                superToken: token0.address,
                flowRate: "100000000000",
            });
            const createFlowRes = await createFlowOperation.exec(signer);
            await createFlowRes.wait();

            console.log("\n_____ LP token0 <-- token1 _____");
            const createFlowOperation2 = sf.cfaV1.createFlow({
                sender: testWalletAddress,
                receiver: superApp.address,
                superToken: token1.address,
                flowRate: "100000000000",
            });
            const createFlowRes2 = await createFlowOperation2.exec(signer);
            await createFlowRes2.wait();

            // skip some time
            await delay(3600);

            // perform one way swap as User A
            console.log("\n_____ User A token0 --> token1 _____");
            await token0.connect(testWalletSigner).transfer(addr1.address, "10000000000");
            const createFlowOperation3 = sf.cfaV1.createFlow({
                sender: addr1.address,
                receiver: superApp.address,
                superToken: token0.address,
                flowRate: "1000000",
                overrides: { gasLimit: 10000000 },
            });
            const createFlowRes3 = await createFlowOperation3.exec(addr1Signer);
            await createFlowRes3.wait();

            await delay(900000000); // fast forward so that User A's stream can be liquidated
            await delay(BigNumber.from("10000000000").div(BigNumber.from("1000000")).toNumber()); // fast forward so that User A's stream can be liquidated

            // liquidate User A's stream from another account
            console.log("\n_____ User A token0 -x-> token1 _____ (liquidation) ");

            const balance = await token0.realtimeBalanceOfNow(addr1.address);
            expect(balance.availableBalance).to.be.lessThan(BigNumber.from(0));
            expect(await token0.isAccountCriticalNow(addr1.address)).to.be.true;

            await sf.cfaV1.deleteFlow({
                sender: addr1.address,
                receiver: superApp.address,
                superToken: token0.address,
                by: testWalletAddress,
                overrides: { gasLimit: 10000000 },
            });

            // total units of token 1 should == total flow of token 0 into pool
            const indexData = await superApp.getIndexData(1);
            const netFlow = ethers.BigNumber.from(
                await sf.cfaV1.getNetFlow({
                    superToken: token0.address,
                    account: superApp.address,
                    providerOrSigner: ethers.provider,
                })
            );
            expect(indexData.totalUnits).to.equal(netFlow);
        });

        it("Delete stream and create another stream", async function () {
            // upgrade tokens
            const daiContract = new ethers.Contract(daiAddress, daiAbi) as TestToken;
            let amnt = "100000000000000000000"; // 100
            await daiContract.connect(testWalletSigner).approve(token0.address, amnt);
            await token0.connect(testWalletSigner).upgrade(amnt);
            await daiContract.connect(testWalletSigner).approve(token1.address, amnt);
            await token1.connect(testWalletSigner).upgrade(amnt);

            // Provide liquidity to pool
            console.log("\n_____ LP token0 --> token1 _____");
            const createFlowOperation = sf.cfaV1.createFlow({
                sender: testWalletAddress,
                receiver: superApp.address,
                superToken: token0.address,
                flowRate: "100000000000",
            });
            const createFlowRes = await createFlowOperation.exec(signer);
            await createFlowRes.wait();

            console.log("\n_____ LP token0 <-- token1 _____");
            const createFlowOperation2 = sf.cfaV1.createFlow({
                sender: testWalletAddress,
                receiver: superApp.address,
                superToken: token1.address,
                flowRate: "100000000000",
            });
            const createFlowRes2 = await createFlowOperation2.exec(signer);
            await createFlowRes2.wait();

            // skip some time
            await delay(3600);

            // perform one way swap as User A
            console.log("\n_____ User A token0 --> token1 _____");
            await token0.connect(testWalletSigner).transfer(addr1.address, "10000000000");
            const createFlowOperation3 = sf.cfaV1.createFlow({
                sender: addr1.address,
                receiver: superApp.address,
                superToken: token0.address,
                flowRate: "10000",
            });
            const createFlowRes3 = await createFlowOperation3.exec(addr1Signer);
            await createFlowRes3.wait();

            // skip some time
            await delay(3600);

            // delete User A's stream
            console.log("\n_____ User A token0 -x-> token1 _____ ");
            const deleteFlowOperation = sf.cfaV1.deleteFlow({
                sender: addr1.address,
                receiver: superApp.address,
                superToken: token0.address,
            });
            const deleteFlowRes = await deleteFlowOperation.exec(addr1Signer);
            await deleteFlowRes.wait();

            // skip some time
            await delay(3600);

            // start stream again from User A
            console.log("\n_____ User A token0 --> token1 _____");
            const createFlowOperation4 = sf.cfaV1.createFlow({
                sender: addr1.address,
                receiver: superApp.address,
                superToken: token0.address,
                flowRate: "10000",
            });
            const createFlowRes4 = await createFlowOperation4.exec(addr1Signer);
            await createFlowRes4.wait();

            // record user A's balance of opposite token
            const balanceA = await token1.balanceOf(addr1.address);

            // skip some time
            await delay(3600);

            // balance should be ~ 3600 * 10000 (pool is roughly 1:1 ratio)
            const balanceB = await token1.balanceOf(addr1.address);
            const difference = balanceB.sub(balanceA);
            const expected = ethers.BigNumber.from(3600).mul(10000);

            expect(difference).to.within(expected.mul(98).div(100), expected.mul(102).div(100));
        });
    });
});
