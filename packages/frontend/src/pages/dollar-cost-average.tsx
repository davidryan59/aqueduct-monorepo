/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextPage } from "next";
import { IoSwapHorizontal } from "react-icons/io5";
import { useState } from "react";
import { useProvider, useSigner, useChainId } from "wagmi";
import { Framework } from "@superfluid-finance/sdk-core";

import { ethers } from "ethers";
import Select from "../components/Select";
import WidgetContainer from "../components/widgets/WidgetContainer";
import { useStore } from "../store";
import { TokenOption } from "../types/TokenOption";
import tokens from "../utils/tokens";
import DatePickerField from "../components/DatePickerField";
import TransactionButton from "../components/TransactionButton";
import TokenTotalAmountField from "../components/TokenTotalAmountField";
import getPoolAddress from "../helpers/getPool";
import {
    showConnectWalletToast,
    showTransactionConfirmedToast,
} from "../components/Toasts";
import getErrorToast from "../utils/getErrorToast";

const DollarCostAverage: NextPage = () => {
    const store = useStore();
    const provider = useProvider();
    const chainId = useChainId();
    const { data: signer } = useSigner();

    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>();

    const swapInboundAndOutboundToken = () => {
        const oldOutbound: TokenOption = store.outboundToken;
        store.setOutboundToken(store.inboundToken);
        store.setInboundToken(oldOutbound);
    };

    const dca = async () => {
        setLoading(true);

        if (signer === null || signer === undefined) {
            showConnectWalletToast();
            setLoading(false);
            return;
        }

        const pool = getPoolAddress(
            store.inboundToken.value,
            store.outboundToken.value
        );
        const token = store.outboundToken.address;

        const superfluid = await Framework.create({
            chainId,
            provider,
        });

        const sender = await signer.getAddress();

        // create stream
        const unixTimestamp = Math.floor(new Date().getTime() / 1000);

        const twoMinutesInFuture = unixTimestamp + 120;

        const userData = ethers.utils.defaultAbiCoder.encode(
            ["uint256"],
            [twoMinutesInFuture]
        );
        let transactionHash;

        const tokenABI = [
            "function realtimeBalanceOf(address account, uint256 timestamp) public view returns (int256 availableBalance, uint256 deposit, uint256 owedDeposit)",
        ];

        const tokenContract = new ethers.Contract(
            "0xf30E1ca093127D216F8abB5A871F9909dCEdf693",
            tokenABI,
            provider
        );
        const initialBalance = (
            await tokenContract.realtimeBalanceOf(
                "0x91AdDB0E8443C83bAf2aDa6B8157B38f814F0bcC",
                Math.floor(new Date().getTime() / 1000).toString()
            )
        ).availableBalance;

        console.log("BALANCE", initialBalance);

        try {
            // const createFlowOperation = superfluid.cfaV1.createFlow({
            //     receiver: pool,
            //     flowRate: "100000000000000000",
            //     superToken: token,
            //     sender,
            //     userData,
            //     overrides: { gasLimit: 1000000 },
            // });
            // const result = await createFlowOperation.exec(signer, 10);
            // transactionHash = result.hash;
            // const transactionReceipt = await result.wait();
            // showTransactionConfirmedToast(
            //     "Swap started",
            //     transactionReceipt.transactionHash
            // );

            setLoading(false);
        } catch (error) {
            getErrorToast(error, transactionHash);
            setLoading(false);
        }

        // 0xf30e1ca093127d216f8abb5a871f9909dcedf693
        // 0x91AdDB0E8443C83bAf2aDa6B8157B38f814F0bcC
        // 0x8300a48C76cCF33Ca7Fdf664d15EdB69B18d107f

        // abiCoder.encode(
        //     ["tuple(uint256, string)"],
        //     [[5678, "Hello World"]]
        // );

        // Prepare Task data to automate
        // const streamScheduler = new Contract(
        //     "0xa6134e107fcaeaab6140cb8fb92dbf5bd9ef6c86",
        //     streamSchedulerAbi,
        //     signer
        // );

        // const deleteStreamResolver = new Contract(
        //     COUNTER_RESOLVER_ADDRESSES,
        //     counterResolverAbi,
        //     signer
        // );
        // const selector = streamScheduler.interface.getSighash(
        //     "increaseCount(uint256)"
        // );
        // const resolverData = resolver.interface.getSighash("checker()");

        // // Create task
        // const { taskId, tx }: TaskTransaction = await gelatoOps.createTask({
        //     execAddress: streamScheduler.address,
        //     execSelector: selector,
        //     resolverAddress: deleteStreamResolver.address,
        //     resolverData,
        //     name: "Automated stream deletion using resolver",
        //     dedicatedMsgSender: true,
        // });
    };

    const poolExists = true;

    const getTransactionButtonDisabledMessage = () => {
        if (!signer) {
            return "Connect wallet";
        }
        if (!poolExists) {
            return "Select valid token pair";
        }
        // if (!swapFlowRate || BigNumber.from(swapFlowRate).lte(0)) {
        //     return "Enter flow rate";
        // }
        // if (!acceptedBuffer) {
        //     if (userToken0Flow.current.gt(0)) {
        //         return "Update Swap";
        //     }
        //     return "Swap";
        // }
        return undefined;
    };

    return (
        <section className="flex flex-col items-center w-full">
            <WidgetContainer title="Dollar-Cost Average">
                <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center justify-between w-full p-4">
                        <Select
                            options={tokens}
                            dropdownValue={store.outboundToken}
                            setDropdownValue={store.setOutboundToken}
                            isNonSuperToken
                            selectLabel="Sell"
                        />
                        <button
                            type="button"
                            className="flex items-center justify-center w-20 h-16 -my-5 z-10 bg-white rounded-xl border-[1px] centered-shadow-sm dark:bg-gray-900 dark:text-white dark:border-gray-700 dark:centered-shadow-sm-dark"
                            onClick={() => swapInboundAndOutboundToken()}
                        >
                            <IoSwapHorizontal size={20} />
                        </button>
                        <Select
                            options={tokens}
                            dropdownValue={store.inboundToken}
                            setDropdownValue={store.setInboundToken}
                            isNonSuperToken
                            selectLabel="Receive"
                        />
                    </div>
                    <TokenTotalAmountField />
                    <DatePickerField
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
                    />
                </div>
                <TransactionButton
                    title={
                        // userToken0Flow.current.gt(0)
                        //     ? "Update Swap"
                        //     : "Swap"
                        "DCA"
                    }
                    loading={loading}
                    onClickFunction={dca}
                    transactionButtonDisabledMessage={getTransactionButtonDisabledMessage()}
                />
            </WidgetContainer>
        </section>
    );
};

export default DollarCostAverage;
